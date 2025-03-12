import fitz  # PyMuPDF
import requests
import os
import json
import sys
from urllib.parse import urlparse

def download_pdf(url):
    """Download PDF from URL to a temporary file"""
    response = requests.get(url)
    response.raise_for_status()
    
    # Get filename from URL or use default
    filename = os.path.basename(urlparse(url).path) or "downloaded.pdf"
    filepath = os.path.join("/tmp", filename)
    
    with open(filepath, 'wb') as f:
        f.write(response.content)
    return filepath

def extract_form_data(pdf_path):
    """Extract form data from a PDF file."""
    doc = fitz.open(pdf_path)
    form_data = {}

    for page_num, page in enumerate(doc):
        fields = page.widgets()
        for field in fields:
            field_name = field.field_name or f"unnamed_field_{page_num}_{len(form_data)}"
            field_type = field.field_type_string
            field_value = field.field_value
            
            # For checkboxes, convert to boolean
            if field_type == "CheckBox":
                field_value = field_value == "Yes"
            
            form_data[field_name] = {
                "type": field_type,
                "value": field_value,
                "page": page_num + 1
            }
    
    return form_data

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "PDF URL is required as an argument"}), file=sys.stderr)
        return 1
        
    url = sys.argv[1]
    
    try:
        pdf_path = download_pdf(url)
        form_data = extract_form_data(pdf_path)
        
        # Convert to JSON for structured output
        structured_output = json.dumps(form_data, indent=2)
        print(structured_output)
        return 0
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
