# app/llm_client.py
import json
import os
import re
import sys

from openai import OpenAI


def _get_client() -> OpenAI:
    """
    Strict client init: if anything is wrong, raise instead of
    silently returning stub data.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set in the environment")

    return OpenAI(api_key=api_key)


def call_style_source(style_query: str, max_items: int = 5):
    """
    Use an LLM with web_search enabled to fetch furniture from
    Wayfair/Amazon.

    Returns JSON like:
      {
        "style": "<normalized_style>",
        "products": [
          {
            "title": "...",
            "retailer": "wayfair" | "amazon",
            "product_url": "...",
            "image_url": "...",
            "price": 123.45 or null,
            "category": "...",
            "tags": ["tag1","tag2"]
          },
          ...
        ]
      }
    """
    client = _get_client()

    system_msg = """
You are a furniture style and sourcing agent for a 3D interior design tool (RenderSpace).

Given a style query like "postmodern bedroom furniture" or "Japandi living room":

- Use web search.
- Restrict results to the following domains ONLY:
  - amazon.com
  - ikea.com
  - walmart.com
  - target.com
  - homedepot.com
  - lowes.com
  - article.com
  - westelm.com
  - cb2.com
  - crateandbarrel.com
  - potterybarn.com
- NEVER use wayfair.com. If a candidate product is on wayfair.com, skip it.

IMAGE REQUIREMENTS (very important):
- The image_url MUST be a REAL product photo that visibly shows the furniture item.
- Do NOT use any generic or placeholder image such as ones that display text like
  "No Image Available" or a camera icon.
- If the HTML for an image has alt text like "No Image Available", "placeholder"
  or similar, skip that image and that product.
- Only include products where you can find a real photo in the gallery.

For each product you must:
- Extract the product page URL (product_url).
- Extract the main product image URL (image_url) — a REAL image of the furniture.
- Estimate price in USD if possible, otherwise use null.
- Assign a category from:
  ["bed","sofa","coffee_table","nightstand","chair","media_console","rug","other"].
- Add a small list of style tags (e.g., ["postmodern","light","curved_edges"]).

Return ONLY strict JSON in this exact shape:

{
  "style": "<normalized_style_string>",
  "products": [
    {
      "title": "...",
      "retailer": "amazon" | "ikea" | "walmart" | "target" | "homedepot" | "lowes" | "article" | "westelm" | "cb2" | "crateandbarrel" | "potterybarn",
      "product_url": "...",
      "image_url": "...",
      "price": 123.45 or null,
      "category": "bed" | "sofa" | "coffee_table" | "nightstand" | "chair" | "media_console" | "rug" | "other",
      "tags": ["tag1","tag2"]
    }
  ]
}

Do not add any explanation text outside the JSON.
"""

    user_msg = f'Style query: "{style_query}"\nMax items: {max_items}\n'

    try:
        resp = client.responses.create(
            model="gpt-4.1-mini",  # or another Responses API model with web_search
            input=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            tools=[{"type": "web_search"}],
        )

        # ---- robust extraction of the JSON text from resp ----
        text = None
        for item in getattr(resp, "output", []):
            content = getattr(item, "content", None)
            if not content:
                # e.g. ResponseFunctionWebSearch has no .content
                continue

            for part in content:
                part_text = getattr(part, "text", None)
                if part_text:
                    text = part_text
                    break

            if text is not None:
                break

        if text is None:
            raise RuntimeError(f"No text content found in response: {resp}")

        raw_text = text.strip()
        print(f"[call_style_source] Raw text from model:\n{raw_text}", file=sys.stderr)

        # First attempt: assume it is pure JSON
        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError:
            # Second attempt: pull out the first {...} block
            match = re.search(r"\{.*\}", raw_text, re.DOTALL)
            if not match:
                raise  # re-raise the original JSONDecodeError

            candidate = match.group(0)
            print(
                "[call_style_source] Trying to parse JSON substring instead.",
                file=sys.stderr,
            )
            data = json.loads(candidate)

        return data

    except Exception as e:
        # Log clearly so you see why live data failed
        print(f"[call_style_source] Live OpenAI call failed: {e}", file=sys.stderr)
        # Re-raise so Cloud Run returns 500 instead of silently hiding issues
        raise
