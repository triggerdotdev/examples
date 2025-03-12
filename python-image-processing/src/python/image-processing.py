from PIL import Image, ImageOps, ImageEnhance
import io
from io import BytesIO
import os
from typing import Tuple, List, Dict, Optional, Union
import logging
import sys
import json
import requests

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ImageProcessor:
    """Image processing utility for resizing, optimizing, and converting images."""
    
    # Supported formats for conversion
    SUPPORTED_FORMATS = ['JPEG', 'PNG', 'WEBP', 'GIF', 'AVIF']
    
    @staticmethod
    def open_image(image_data: Union[bytes, str]) -> Image.Image:
        """Open an image from bytes or file path."""
        try:
            if isinstance(image_data, bytes):
                return Image.open(io.BytesIO(image_data))
            else:
                return Image.open(image_data)
        except Exception as e:
            logger.error(f"Failed to open image: {e}")
            raise ValueError(f"Could not open image: {e}")
    
    @staticmethod
    def resize_image(
        img: Image.Image, 
        width: Optional[int] = None, 
        height: Optional[int] = None,
        maintain_aspect_ratio: bool = True
    ) -> Image.Image:
        """
        Resize an image to specified dimensions.
        
        Args:
            img: PIL Image object
            width: Target width (None to auto-calculate from height)
            height: Target height (None to auto-calculate from width)
            maintain_aspect_ratio: Whether to maintain the original aspect ratio
            
        Returns:
            Resized PIL Image
        """
        if width is None and height is None:
            return img  # No resize needed
            
        original_width, original_height = img.size
        
        if maintain_aspect_ratio:
            if width and height:
                # Calculate the best fit while maintaining aspect ratio
                ratio = min(width / original_width, height / original_height)
                new_width = int(original_width * ratio)
                new_height = int(original_height * ratio)
            elif width:
                # Calculate height based on width
                ratio = width / original_width
                new_width = width
                new_height = int(original_height * ratio)
            else:
                # Calculate width based on height
                ratio = height / original_height
                new_width = int(original_width * ratio)
                new_height = height
        else:
            # Force exact dimensions
            new_width = width if width else original_width
            new_height = height if height else original_height
        
        return img.resize((new_width, new_height), Image.LANCZOS)
    
    @staticmethod
    def optimize_image(
        img: Image.Image, 
        quality: int = 85, 
        format: Optional[str] = None
    ) -> Tuple[bytes, str]:
        """
        Optimize an image for web delivery.
        
        Args:
            img: PIL Image object
            quality: JPEG/WebP quality (0-100)
            format: Output format (JPEG, PNG, WEBP, etc.)
            
        Returns:
            Tuple of (image_bytes, format)
        """
        if format is None:
            format = img.format or 'JPEG'
        
        format = format.upper()
        if format not in ImageProcessor.SUPPORTED_FORMATS:
            format = 'JPEG'  # Default to JPEG if unsupported format
        
        # Convert mode if needed
        if format == 'JPEG' and img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # Save to bytes
        buffer = io.BytesIO()
        
        if format == 'JPEG':
            img.save(buffer, format=format, quality=quality, optimize=True)
        elif format == 'PNG':
            img.save(buffer, format=format, optimize=True)
        elif format == 'WEBP':
            img.save(buffer, format=format, quality=quality)
        elif format == 'AVIF':
            img.save(buffer, format=format, quality=quality)
        else:
            img.save(buffer, format=format)
            
        buffer.seek(0)
        return buffer.getvalue(), format.lower()
    
    @staticmethod
    def apply_filters(
        img: Image.Image,
        brightness: Optional[float] = None,
        contrast: Optional[float] = None,
        sharpness: Optional[float] = None,
        grayscale: bool = False
    ) -> Image.Image:
        """
        Apply various filters and enhancements to an image.
        
        Args:
            img: PIL Image object
            brightness: Brightness factor (0.0-2.0, 1.0 is original)
            contrast: Contrast factor (0.0-2.0, 1.0 is original)
            sharpness: Sharpness factor (0.0-2.0, 1.0 is original)
            grayscale: Convert to grayscale if True
            
        Returns:
            Processed PIL Image
        """
        # Apply grayscale first if requested
        if grayscale:
            img = ImageOps.grayscale(img)
            # Convert back to RGB if other filters will be applied
            if any(x is not None for x in [brightness, contrast, sharpness]):
                img = img.convert('RGB')
        
        # Apply enhancements
        if brightness is not None:
            img = ImageEnhance.Brightness(img).enhance(brightness)
        
        if contrast is not None:
            img = ImageEnhance.Contrast(img).enhance(contrast)
            
        if sharpness is not None:
            img = ImageEnhance.Sharpness(img).enhance(sharpness)
            
        return img
    
    @staticmethod
    def process_image(
        image_data: Union[bytes, str],
        width: Optional[int] = None,
        height: Optional[int] = None,
        maintain_aspect_ratio: bool = True,
        quality: int = 85,
        output_format: Optional[str] = None,
        brightness: Optional[float] = None,
        contrast: Optional[float] = None,
        sharpness: Optional[float] = None,
        grayscale: bool = False
    ) -> Dict:
        """
        Process an image with all available options.
        
        Args:
            image_data: Image bytes or file path
            width: Target width
            height: Target height
            maintain_aspect_ratio: Whether to maintain aspect ratio
            quality: Output quality
            output_format: Output format
            brightness: Brightness adjustment
            contrast: Contrast adjustment
            sharpness: Sharpness adjustment
            grayscale: Convert to grayscale
            
        Returns:
            Dict with processed image data and metadata
        """
        # Open the image
        img = ImageProcessor.open_image(image_data)
        original_format = img.format
        original_size = img.size
        
        # Apply filters
        img = ImageProcessor.apply_filters(
            img, 
            brightness=brightness, 
            contrast=contrast, 
            sharpness=sharpness, 
            grayscale=grayscale
        )
        
        # Resize if needed
        if width or height:
            img = ImageProcessor.resize_image(
                img, 
                width=width, 
                height=height, 
                maintain_aspect_ratio=maintain_aspect_ratio
            )
        
        # Optimize and get bytes
        processed_bytes, actual_format = ImageProcessor.optimize_image(
            img, 
            quality=quality, 
            format=output_format
        )
        
        # Return result with metadata
        return {
            "processed_image": processed_bytes,
            "format": actual_format,
            "original_format": original_format,
            "original_size": original_size,
            "new_size": img.size,
            "file_size_bytes": len(processed_bytes)
        }

def process_image(url, height, width, quality):
    # Download image from URL
    response = requests.get(url)
    img = Image.open(BytesIO(response.content))
    
    # Resize
    img = img.resize((int(width), int(height)), Image.Resampling.LANCZOS)
    
    # Save with quality setting
    output_path = f"/tmp/processed_{width}x{height}.jpg"
    img.save(output_path, "JPEG", quality=int(quality))
    
    return output_path

if __name__ == "__main__":
    url = sys.argv[1]
    height = int(sys.argv[2])
    width = int(sys.argv[3])
    quality = int(sys.argv[4])
    maintain_aspect_ratio = sys.argv[5].lower() == 'true'
    output_format = sys.argv[6]
    brightness = float(sys.argv[7]) if sys.argv[7] != 'null' else None
    contrast = float(sys.argv[8]) if sys.argv[8] != 'null' else None
    sharpness = float(sys.argv[9]) if sys.argv[9] != 'null' else None
    grayscale = sys.argv[10].lower() == 'true'
    
    processor = ImageProcessor()
    result = processor.process_image(
        requests.get(url).content,
        width=width,
        height=height,
        maintain_aspect_ratio=maintain_aspect_ratio,
        quality=quality,
        output_format=output_format,
        brightness=brightness,
        contrast=contrast,
        sharpness=sharpness,
        grayscale=grayscale
    )
    
    output_path = f"/tmp/processed_{width}x{height}.{result['format']}"
    with open(output_path, 'wb') as f:
        f.write(result['processed_image'])
    
    print(json.dumps({
        "outputPath": output_path,
        "format": result['format'],
        "originalSize": result['original_size'],
        "newSize": result['new_size'],
        "fileSizeBytes": result['file_size_bytes']
    }))
