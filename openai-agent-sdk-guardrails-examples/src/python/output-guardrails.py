from pydantic import BaseModel
from agents import (
    Agent,
    GuardrailFunctionOutput,
    OutputGuardrailTripwireTriggered,
    RunContextWrapper,
    Runner,
    TResponseInputItem,
    output_guardrail,
)
import asyncio
import sys
import json

class MessageOutput(BaseModel): 
    response: str

class MathOutput(BaseModel): 
    reasoning: str
    is_math: bool

guardrail_agent = Agent(
    name="Math Content Guardrail",
    instructions="Check if the output contains explicit mathematical content like equations, formulas, calculations, or mathematical problem solving. Only set is_math to True if there are actual mathematical expressions, numbers being calculated, or mathematical concepts being explained with formulas. General topics, even if they could theoretically involve math, should be is_math=False.",
    output_type=MathOutput,
)

@output_guardrail
async def math_guardrail(  
    ctx: RunContextWrapper, agent: Agent, output: MessageOutput
) -> GuardrailFunctionOutput:
    result = await Runner.run(guardrail_agent, output.response, context=ctx.context)

    return GuardrailFunctionOutput(
        output_info=result.final_output,
        tripwire_triggered=not result.final_output.is_math,  # Trip when NOT math
    )

agent = Agent( 
    name="Math Assistant",
    instructions="You are a helpful assistant. Give very short, concise answers (1-2 sentences max). If asked about mathematics, provide brief math explanations. If asked about other topics, just answer the question directly without trying to relate it to math.",
    output_guardrails=[math_guardrail],
    output_type=MessageOutput,
)

async def main():
    # Get prompt from command line or use default
    default_prompt = "Can you explain what a quadratic equation is?"
    if len(sys.argv) > 1:
        prompt = str(sys.argv[1])
        # Replace [object Object] with default prompt (in case of old calls)
        if prompt == "[object Object]" or not prompt.strip():
            prompt = default_prompt
    else:
        prompt = default_prompt
    
    # Format input properly like in input-guardrails.py
    input_data: list[TResponseInputItem] = [
        {
            "role": "user",
            "content": prompt,
        }
    ]
    
    # Try to run the agent with the prompt
    try:
        result = await Runner.run(agent, input_data)
        # Output JSON for TypeScript to parse
        output = {
            "response": result.final_output.response,
            "guardrail_triggered": False,
            "received_prompt": prompt
        }
        print(json.dumps(output))

    except OutputGuardrailTripwireTriggered as e:
        # Output JSON for TypeScript to parse
        output = {
            "response": "Guardrail triggered - response didn't contain sufficient math content",
            "guardrail_triggered": True,
            "math_analysis": e.guardrail_result.agent_output.response,
            "received_prompt": prompt
        }
        print(json.dumps(output))

if __name__ == "__main__":
    asyncio.run(main())