import csv
import io
import logging
import wordninja
from flask import Flask, render_template, request, send_file, jsonify, make_response
import re
from collections import Counter
import math
import random

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Initialize Flask app
app = Flask(__name__)
app.secret_key = "your-secret-key-here"

# Define our set of acronyms (do NOT include "ai" here)
ACRONYMS = {
    "gpt", "seo", "llm", "nft", "dns", "llc"
}

def protect_acronyms(text):
    """Replace each known acronym (case-insensitive) with a marker so it won't be split."""
    for acronym in ACRONYMS:
        pattern = re.compile(re.escape(acronym), re.IGNORECASE)
        text = pattern.sub(lambda m: f"__{acronym.upper()}__", text)
    return text

def restore_acronyms(text):
    """Replace markers with the original (upper-case) acronym."""
    for acronym in ACRONYMS:
        text = text.replace(f"__{acronym.upper()}__", acronym.upper())
    return text

def calculate_confidence(words, original_text):
    """Calculate confidence score for word splitting."""
    confidence = 100
    short_words = sum(1 for w in words if len(w) < 3)
    confidence -= short_words * 5
    long_words = sum(1 for w in words if len(w) > 12)
    confidence -= long_words * 10
    for acronym in ACRONYMS:
        if acronym.upper() in [w.upper() for w in words]:
            confidence += 5
    if re.search(r'[a-zA-Z][0-9]+[a-zA-Z]', original_text):
        confidence -= 10
    return max(0, min(100, confidence))

def merge_short_tokens(tokens, max_length=2):
    """
    Merge consecutive tokens that are very short (length <= max_length).
    For instance, ["s", "a", "co", "maine"] becomes ["saco", "maine"].
    """
    merged = []
    buffer = []
    for token in tokens:
        if len(token) <= max_length:
            buffer.append(token)
        else:
            if buffer:
                # Merge the buffered tokens into one token
                merged.append(''.join(buffer))
                buffer = []
            merged.append(token)
    if buffer:
        merged.append(''.join(buffer))
    return merged

def split_with_acronyms(text):
    """
    Splits text into tokens while preserving any protected acronym markers (e.g. "__GPT__").
    If a piece does not match a marker, it is split using wordninja.
    """
    pattern = r'(__[A-Z]+__)'
    parts = re.split(pattern, text)
    tokens = []
    for part in parts:
        if not part:
            continue
        if re.fullmatch(pattern, part):
            tokens.append(part)
        else:
            tokens.extend(wordninja.split(part))
    return tokens

def merge_leading_a(tokens, min_length=5):
    """
    If the first token is 'a', merge it with subsequent tokens until the merged
    token reaches at least min_length characters.
    """
    if tokens and tokens[0].lower() == 'a':
        merged = tokens[0]
        idx = 1
        while idx < len(tokens) and len(merged) < min_length:
            merged += tokens[idx]
            idx += 1
        return [merged] + tokens[idx:]
    return tokens

def merge_leading_singleton(tokens, min_next_length=4):
    """
    If the first token is a single letter:
      - If it's not "a", or if it is "a" but the next token is very short,
        merge it with the following token.
    """
    if tokens and len(tokens[0]) == 1 and len(tokens) > 1:
        # For an 'a' we might want to keep it separate—as in "A Bold Choice"—
        # unless the next token is very short (suggesting a spurious split).
        if tokens[0].lower() != 'a' or (len(tokens[1]) < min_next_length):
            tokens[1] = tokens[0] + tokens[1]
            tokens.pop(0)
    return tokens

def merge_trailing_singleton(tokens, max_prev_length=3):
    """
    If the last token is a single letter and the previous token is short,
    merge it with the previous token.
    """
    if tokens and len(tokens[-1]) == 1 and len(tokens) > 1:
        if len(tokens[-2]) <= max_prev_length:
            tokens[-2] = tokens[-2] + tokens[-1]
            tokens.pop(-1)
    return tokens

def convert_to_camel_case(domain):
    """
    Converts a domain name while handling special cases:
    - Preserves known acronyms (like GPT)
    - Handles 'ai' prefix and suffix specially
    - Maintains proper camelCase format
    - Merges very short tokens to avoid spurious splits
    - Special handling for leading 'a' in domain names
    """
    parts = domain.split('.')
    if len(parts) < 2:
        return domain, domain, 0, 0

    # Work in lower-case for consistency
    main = parts[0].lower()
    extension = '.'.join(parts[1:]).lower()

    if main == "ai":
        words = ["ai"]
    else:
        prefix_token = None
        suffix_token = None

        # Check for an "ai" prefix
        if main.startswith("ai") and len(main) > 2:
            prefix_token = "ai"
            main = main[2:]
        # Check for an "ai" suffix
        elif main.endswith("ai") and len(main) > 2:
            suffix_token = "ai"
            main = main[:-2]

        # Protect known acronyms in the middle
        protected_middle = protect_acronyms(main)
        # Use split_with_acronyms to preserve markers
        middle_tokens = split_with_acronyms(protected_middle) if main else []

        # Restore acronyms in middle tokens
        middle_tokens = [restore_acronyms(token) for token in middle_tokens]

        # First, merge consecutive very short tokens
        middle_tokens = merge_short_tokens(middle_tokens, max_length=2)
        # Then merge any leading or trailing singleton tokens
        middle_tokens = merge_leading_singleton(middle_tokens, min_next_length=4)
        middle_tokens = merge_trailing_singleton(middle_tokens, max_prev_length=3)
        # Finally, handle special case for leading 'a'
        middle_tokens = merge_leading_a(middle_tokens, min_length=5)

        # Assemble final token list
        words = []
        if prefix_token:
            words.append(prefix_token)
        words.extend(middle_tokens)
        if suffix_token:
            words.append(suffix_token)

    # Process tokens for both formats
    processed = []
    for token in words:
        if token.lower() == "ai":
            processed.append("AI")
        elif token.isupper() or token in [acronym.upper() for acronym in ACRONYMS]:
            processed.append(token)
        else:
            processed.append(token.capitalize())

    spaced_words = ' '.join(processed)
    camel_main = ''.join(processed)

    word_count = len(words)
    confidence = calculate_confidence(words, parts[0])

    return f"{camel_main}.{extension}", spaced_words, word_count, confidence

def calculate_word_cloud_layout(words, counts, width=800, height=400):
    """Calculate word positions for the word cloud."""
    # Limit to top 50 words
    if len(words) > 50:
        words = words[:50]
        counts = counts[:50]

    logging.debug(f"Processing {len(words)} words for word cloud")

    max_count = max(counts)
    min_count = min(counts)
    count_range = max_count - min_count + 1

    # Calculate font sizes with better scaling
    font_sizes = []
    positions = []

    for count in counts:
        # Scale font size between 20 and 80 based on frequency
        size = 20 + (count - min_count) * (60 / count_range)
        font_sizes.append(round(size))

    def check_collision(x1, y1, size1, positions):
        """Check if a word would overlap with existing words"""
        padding = 5  # Minimum pixels between words
        for pos in positions:
            x2, y2 = pos['x'], pos['y']
            size2 = pos['size']
            # Calculate the distance between word centers
            distance = math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
            # If distance is less than combined half-sizes plus padding, they overlap
            if distance < (size1 + size2) / 2 + padding:
                return True
        return False

    # Use a spiral layout
    for i, (word, size) in enumerate(zip(words, font_sizes)):
        # Start from center
        angle = 0
        radius = size  # Start radius based on word size
        step = 0.1  # Angle increment
        radiusStep = 2  # Radius increment

        # Keep trying positions until we find one without collision
        while True:
            x = round(math.cos(angle) * radius)
            y = round(math.sin(angle) * radius)

            # Check if this position works
            if not check_collision(x, y, size, positions):
                positions.append({
                    'text': word,
                    'size': size,
                    'x': x,
                    'y': y,
                    'rotate': 0  # Keep words horizontal for better readability
                })
                break

            angle += step
            # Increase radius gradually as we spiral out
            radius += radiusStep * step

            # Prevent infinite loops
            if radius > max(width, height):
                # If we can't find a spot, place it far out
                x = round(math.cos(random.random() * 2 * math.pi) * width/2)
                y = round(math.sin(random.random() * 2 * math.pi) * height/2)
                positions.append({
                    'text': word,
                    'size': size,
                    'x': x,
                    'y': y,
                    'rotate': 0
                })
                break

    logging.debug(f"Generated word cloud positions: {positions[:2]}...")
    return positions

def process_domains(domains):
    """Process a list of domains and collect word statistics."""
    results = []
    word_freq = Counter()
    sld_lengths = Counter()  # Counter for SLD lengths
    tld_freq = Counter()  # Counter for TLD frequencies

    for domain in domains:
        if domain.strip():
            # Get TLD (everything after the first period)
            parts = domain.strip().split('.')
            if len(parts) > 1:
                tld = '.'.join(parts[1:])
                tld_freq[tld] += 1

            converted, split_words, word_count, confidence = convert_to_camel_case(domain)
            # Get SLD length (characters before first period)
            sld = domain.split('.')[0]
            sld_length = len(sld)

            result = {
                'original': domain,
                'converted': converted,
                'split': split_words,
                'word_count': word_count,
                'confidence': confidence,
                'sld_length': sld_length  # Add SLD length to results
            }
            results.append(result)
            words = split_words.lower().split()
            word_freq.update(words)
            sld_lengths[sld_length] += 1

    # Get top 50 most common words
    word_stats = [
        {'word': word, 'count': count}
        for word, count in word_freq.most_common(50)
    ]

    # Get SLD length statistics, sorted by count (descending), then length
    sld_stats = [
        {'length': length, 'count': count}
        for length, count in sorted(sld_lengths.items(), key=lambda x: (-x[1], -x[0]))
    ]

    # Get TLD statistics, sorted by count (descending)
    tld_stats = [
        {'tld': tld, 'count': count}
        for tld, count in sorted(tld_freq.items(), key=lambda x: (-x[1], x[0]))
    ]

    # Calculate word cloud layout for top words
    words, counts = zip(*[(stat['word'], stat['count']) for stat in word_stats])
    word_cloud_data = calculate_word_cloud_layout(words, counts)

    return {
        'results': results,
        'word_stats': word_stats,
        'word_cloud': word_cloud_data,
        'sld_stats': sld_stats,  # Add SLD statistics to response
        'tld_stats': tld_stats   # Add TLD statistics to response
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/convert', methods=['POST'])
def convert():
    try:
        if request.is_json:
            data = request.get_json()
            domains = data.get('domains', [])
            if not domains:
                return jsonify({'error': 'No domains provided'}), 400
            result = process_domains(domains)
            return jsonify(result)

        elif 'file' in request.files:
            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': 'No file selected'}), 400
            if not file.filename.endswith('.csv'):
                return jsonify({'error': 'Please upload a CSV file'}), 400

            stream = io.StringIO(file.stream.read().decode("UTF8"))
            reader = csv.reader(stream)
            domains = []
            for row in reader:
                if row:
                    domain = row[0].strip()
                    if domain:
                        domains.append(domain)

            if not domains:
                return jsonify({'error': 'No valid domains found in CSV'}), 400

            result = process_domains(domains)
            return jsonify(result)

        else:
            return jsonify({'error': 'No data provided'}), 400

    except Exception as e:
        logging.error(f"Error processing request: {str(e)}")
        return jsonify({'error': 'Error processing request'}), 500

@app.route('/download/word-stats', methods=['POST'])
def download_word_stats():
    try:
        data = request.get_json()
        if not data or 'word_stats' not in data:
            return jsonify({'error': 'No word statistics data provided'}), 400

        # Create a string buffer for the CSV data
        output = io.StringIO(newline='')
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

        # Write headers
        writer.writerow(['Word', 'Occurrences'])

        # Write data rows
        for word_stat in data['word_stats']:
            writer.writerow([word_stat['word'], word_stat['count']])

        # Get the value and close the buffer
        csv_data = output.getvalue()
        output.close()

        # Create a response with the CSV data
        response = make_response(csv_data)
        response.headers['Content-Type'] = 'text/csv'
        response.headers['Content-Disposition'] = 'attachment; filename=word_statistics.csv'
        return response

    except Exception as e:
        logging.error(f"Error generating word stats CSV: {str(e)}")
        return jsonify({'error': 'Error generating CSV'}), 500

@app.route('/download/sld-stats', methods=['POST'])
def download_sld_stats():
    try:
        data = request.get_json()
        if not data or 'sld_stats' not in data:
            return jsonify({'error': 'No SLD statistics data provided'}), 400

        # Create a string buffer for the CSV data
        output = io.StringIO(newline='')
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

        # Write headers
        writer.writerow(['SLD Length', 'Number of Domains'])

        # Write data rows
        for sld_stat in data['sld_stats']:
            writer.writerow([sld_stat['length'], sld_stat['count']])

        # Get the value and close the buffer
        csv_data = output.getvalue()
        output.close()

        # Create a response with the CSV data
        response = make_response(csv_data)
        response.headers['Content-Type'] = 'text/csv'
        response.headers['Content-Disposition'] = 'attachment; filename=sld_length_statistics.csv'
        return response

    except Exception as e:
        logging.error(f"Error generating SLD stats CSV: {str(e)}")
        return jsonify({'error': 'Error generating CSV'}), 500

@app.route('/download/tld-stats', methods=['POST'])
def download_tld_stats():
    try:
        data = request.get_json()
        if not data or 'tld_stats' not in data:
            return jsonify({'error': 'No TLD statistics data provided'}), 400

        # Create a string buffer for the CSV data
        output = io.StringIO(newline='')
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

        # Write headers
        writer.writerow(['TLD', 'Number of Domains'])

        # Write data rows
        for tld_stat in data['tld_stats']:
            writer.writerow([tld_stat['tld'], tld_stat['count']])

        # Get the value and close the buffer
        csv_data = output.getvalue()
        output.close()

        # Create a response with the CSV data
        response = make_response(csv_data)
        response.headers['Content-Type'] = 'text/csv'
        response.headers['Content-Disposition'] = 'attachment; filename=tld_statistics.csv'
        return response

    except Exception as e:
        logging.error(f"Error generating TLD stats CSV: {str(e)}")
        return jsonify({'error': 'Error generating CSV'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)