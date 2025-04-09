import json
import sys
from markitdown import MarkItDown

def convert_file_to_markdown(file_path):
    """Convert a file from a local path to markdown"""
    md = MarkItDown()
    result = md.convert_file(file_path)
    return result.text_content

def process_trigger_task(file_path):
    """Process a file using MarkItDown"""
    markdown_result = convert_file_to_markdown(file_path)
    return {
        "status": "success",
        "markdown": markdown_result
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