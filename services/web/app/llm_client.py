# services/web/app/llm_client.py
import json
import random
import sys
from openai import OpenAI

client = OpenAI()


def _stub_products(style_query: str, max_items: int):
    """Fallback if OpenAI/web_search fails."""
    products = []
    for i in range(max_items):
        products.append(
            {
                "title": f"Demo item {i + 1} for {style_query}",
                "retailer": "demo",
                "product_url": "https://example.com",
                "image_url": f"https://via.placeholder.com/300x200?text=Item+{i+1}",
                "price": round(random.uniform(50, 500), 2),
                "category": "other",
                "tags": [style_query],
            }
        )
    return {"style": style_query, "products": products}


def call_style_source(style_query: str, max_items: int = 5):
    """
    Use an LLM with web_search enabled to fetch furniture from Wayfair/Amazon.

    Returns:
      {
        "style": "<normalized_style>",
        "products": [ { ... }, ... ]
      }
    """
    system_msg = """
You are a furniture style and sourcing agent for a 3D interior design tool (RenderSpace).

Given a style query like "postmodern bedroom furniture" or "Japandi living room":

- Use web search.
- Restrict results to wayfair.com and amazon.com only.
- Return up to N furniture pieces that match the query.
- Focus on core room furniture (beds, sofas, tables, nightstands, chairs, consoles, rugs).

For each product you must:
- Extract the product page URL (product_url).
- Extract the main product image URL (image_url) — the first clear product image.
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
      "retailer": "wayfair" or "amazon",
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
            model="gpt-4.1-mini",  # adjust to a model you have access to
            input=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            tools=[{"type": "web_search"}],
        )

        # Adjust this if your SDK version differs
        text = resp.output[0].content[0].text
        data = json.loads(text)
        return data
    except Exception as e:
        # Log the error so you can see it in the server logs
        print(f"[call_style_source] Error calling OpenAI: {e}", file=sys.stderr, flush=True)
        # Fallback to stub so the API still returns 200
        return _stub_products(style_query, max_items)
