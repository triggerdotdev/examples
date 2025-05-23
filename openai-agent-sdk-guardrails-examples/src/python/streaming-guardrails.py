from __future__ import annotations

import asyncio
import sys
import json

from openai.types.responses import ResponseTextDeltaEvent
from pydantic import BaseModel, Field

from agents import Agent, Runner

"""
This example shows how to use guardrails as the model is streaming. Output guardrails run after the
final output has been generated; this example runs guardrails every N characters, allowing for early
termination if bad output is detected.

The expected output is that you'll see a bunch of tokens stream in, then the guardrail will trigger
and stop the streaming.
"""


agent = Agent(
    name="Assistant",
    instructions=(
        "You are a helpful assistant. Provide clear, informative answers to questions. "
        "Explain topics in a natural way with appropriate detail and terminology."
    ),
)


class GuardrailOutput(BaseModel):
    reasoning: str = Field(
        description="Brief explanation of the specific word or concept that's too complex for a ten year old."
    )
    is_readable_by_ten_year_old: bool = Field(
        description="Whether the response is understandable by a ten year old."
    )


guardrail_agent = Agent(
    name="Checker",
    instructions=(
        "Check if the response uses words or concepts too complex for a ten year old. "
        "If it does, identify the specific problematic word or phrase. Be brief and specific."
    ),
    output_type=GuardrailOutput,
    model="gpt-4o-mini",
)


async def check_guardrail(text: str) -> GuardrailOutput:
    result = await Runner.run(guardrail_agent, text)
    return result.final_output_as(GuardrailOutput)


async def process_prompt(question: str, check_interval: int = 30):
    result = Runner.run_streamed(agent, question)
    current_text = ""
    guardrail_triggered = False
    guardrail_reason = ""
    guardrail_triggered_at = None
    character_limit = 600

    # We will check the guardrail every N characters
    next_guardrail_check_len = check_interval
    guardrail_task = None
    guardrail_check_started_at = None

    async for event in result.stream_events():
        # Check if the guardrail has been triggered BEFORE processing new chunks
        if guardrail_task and guardrail_task.done():
            guardrail_result = guardrail_task.result()
            if not guardrail_result.is_readable_by_ten_year_old:
                guardrail_triggered = True
                guardrail_reason = guardrail_result.reasoning
                guardrail_triggered_at = guardrail_check_started_at  # Use when check started, not when it completed
                break
            else:
                guardrail_task = None
                guardrail_check_started_at = None

        if event.type == "raw_response_event" and isinstance(event.data, ResponseTextDeltaEvent):
            # Stream the chunk to stdout immediately
            print(event.data.delta, end="", flush=True)
            current_text += event.data.delta

            # Check if it's time to run the guardrail check
            if len(current_text) >= next_guardrail_check_len and not guardrail_task:
                guardrail_check_started_at = len(current_text)  # Record when this check started
                guardrail_task = asyncio.create_task(check_guardrail(current_text))
                next_guardrail_check_len += check_interval

            # Check guardrail status again AFTER processing this chunk
            if guardrail_task and guardrail_task.done():
                guardrail_result = guardrail_task.result()
                if not guardrail_result.is_readable_by_ten_year_old:
                    guardrail_triggered = True
                    guardrail_reason = guardrail_result.reasoning
                    guardrail_triggered_at = guardrail_check_started_at  # Use when check started, not when it completed
                    break
                else:
                    guardrail_task = None
                    guardrail_check_started_at = None

        # Check character limit after processing the chunk
        if len(current_text) >= character_limit:
            break

    # Do one final check on the final output if guardrail hasn't been triggered yet
    if not guardrail_triggered:
        final_check_started_at = len(current_text)
        guardrail_result = await check_guardrail(current_text)
        if not guardrail_result.is_readable_by_ten_year_old:
            guardrail_triggered = True
            guardrail_reason = guardrail_result.reasoning
            guardrail_triggered_at = final_check_started_at

    # Print a newline after the streamed response
    print()
    
    return {
        "response": current_text,
        "guardrail_triggered": guardrail_triggered,
        "guardrail_reason": guardrail_reason,
        "guardrail_triggered_at": guardrail_triggered_at,
        "guardrail_evaluated_text_length": guardrail_triggered_at if guardrail_triggered else None,
        "characters_checked_at_interval": check_interval,
        "total_characters": len(current_text)
    }


if __name__ == "__main__":
    # Get the prompt and check interval from command line
    prompt = sys.argv[1] if len(sys.argv) > 1 else ""
    check_interval = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    
    result = asyncio.run(process_prompt(prompt, check_interval))
    
    # Print guardrail information as JSON
    print(json.dumps(result))