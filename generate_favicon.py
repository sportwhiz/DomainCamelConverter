from PIL import Image, ImageDraw

def create_circular_image(input_path, output_path, size=(32, 32)):
    # Open the original image
    img = Image.open(input_path)
    
    # Create a new image with transparency
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    
    # Draw a filled circle on the mask
    draw.ellipse((0, 0) + size, fill=255)
    
    # Resize the input image to match the size
    output = img.resize(size, Image.Resampling.LANCZOS)
    
    # Ensure the output image has an alpha channel
    output = output.convert('RGBA')
    
    # Apply the circular mask
    output.putalpha(mask)
    
    # Save the result
    output.save(output_path, 'PNG')

# Generate the circular favicon
create_circular_image('static/images/camellogo.png', 'static/images/favicon.png')
