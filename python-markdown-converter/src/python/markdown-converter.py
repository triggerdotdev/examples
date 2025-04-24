import json
import sys
import os
from markitdown import MarkItDown

def convert_to_markdown(file_path):
    """Convert a file to markdown format using MarkItDown"""
    # Check if file exists
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    # Initialize MarkItDown
    md = MarkItDown()
    
    # Convert the file
    try:
        result = md.convert(file_path)
        return result.text_content
    except Exception as e:
        raise Exception(f"Error converting file: {str(e)}")

def process_trigger_task(file_path):
    """Process a file and convert to markdown"""
    try:
        markdown_result = convert_to_markdown(file_path)
        return {
            "status": "success",
            "markdown": markdown_result
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

if __name__ == "__main__":
    # Get the file path from command line arguments
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "error": "No file path provided"}))
        sys.exit(1)
    
    try:
        config = json.loads(sys.argv[1])
        file_path = config.get("file_path")
        
        if not file_path:
            print(json.dumps({"status": "error", "error": "No file path specified in config"}))
            sys.exit(1)
            
        result = process_trigger_task(file_path)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"status": "error", "error": str(e)}))
        sys.exit(1)