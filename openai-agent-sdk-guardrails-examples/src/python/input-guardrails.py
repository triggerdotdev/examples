from __future__ import annotations

import asyncio
import sys
import json

from pydantic import BaseModel

from agents import (
    Agent,
    GuardrailFunctionOutput,
    InputGuardrailTripwireTriggered,
    RunContextWrapper,
    Runner,
    TResponseInputItem,
    input_guardrail,
)

"""
This example shows how to use guardrails.

Guardrails are checks that run in parallel to the agent's execution.
They can be used to do things like:
- Check if input messages are off-topic
- Check that output messages don't violate any policies
- Take over control of the agent's execution if an unexpected input is detected

In this example, we'll setup an input guardrail that trips if the user is asking about something 
that is NOT related to math. If the guardrail trips, we'll respond with a refusal message.
"""


### 1. An agent-based guardrail that is triggered if the user is asking about non-math topics
class MathTopicOutput(BaseModel):
    reasoning: str
    is_math_related: bool


guardrail_agent = Agent(
    name="Guardrail check",
    instructions="Check if the user's question is related to mathematics. Only return true if it's clearly a math question (algebra, calculus, geometry, statistics, arithmetic, etc).",
    output_type=MathTopicOutput,
)


@input_guardrail
async def non_math_guardrail(
    context: RunContextWrapper[None], agent: Agent, input: str | list[TResponseInputItem]
) -> GuardrailFunctionOutput:
    """This is an input guardrail function that checks if the input is related to math.
    If it's not math-related, the guardrail trips.
    """
    result = await Runner.run(guardrail_agent, input, context=context.context)
    final_output = result.final_output_as(MathTopicOutput)

    return GuardrailFunctionOutput(
        output_info=final_output,
        # Trigger when it's NOT math related
        tripwire_triggered=not final_output.is_math_related,
    )


### 2. The run loop

async def process_prompt(prompt: str):
    agent = Agent(
        name="Math tutor",
        instructions="You are a helpful math tutor. You provide clear explanations for mathematics problems and concepts. You help students understand mathematical concepts rather than just giving answers.",
        input_guardrails=[non_math_guardrail],
    )

    input_data: list[TResponseInputItem] = [
        {
            "role": "user",
            "content": prompt,
        }
    ]

    try:
        result = await Runner.run(agent, input_data)
        return {
            "response": result.final_output,
            "guardrail_triggered": False
        }
    except InputGuardrailTripwireTriggered:
        # If the guardrail triggered, it's not a math question
        return {
            "response": "I'm a math tutor and can only help with mathematics-related questions. Please ask me something about math instead.",
            "guardrail_triggered": True
        }

if __name__ == "__main__":
    # Get the prompt from command line
    prompt = sys.argv[1] if len(sys.argv) > 1 else ""
    result = asyncio.run(process_prompt(prompt))
    print(json.dumps(result))