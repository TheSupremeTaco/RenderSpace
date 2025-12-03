# llm_client.py
import json
from openai import OpenAI

client = OpenAI()


def call_style_source(style_query: str, max_items: int = 5):
    """
    Use an LLM with web_search enabled to fetch furniture from Wayfair/Amazon.

    Returns:
      {
        "style": "<normalized_style>",
        "products": [
          {
            "title": "...",
            "retailer": "wayfair" | "amazon",
            "product_url": "...",
            "image_url": "...",
            "price": 123.45 or null,
            "category": "bed" | "sofa" | "coffee_table" | "nightstand" | "chair" | "media_console" | "rug" | "other",
            "tags": ["postmodern","light","curved_edges"]
          },
          ...
        ]
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

    user_msg = f"""
Style query: "{style_query}"
Max items: {max_items}
"""

    resp = client.responses.create(
        model="gpt-4.1-mini",  # or another responses-capable model
        input=[
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ],
        tools=[{"type": "web_search"}],
    )

    # Adjust this line if your SDK response structure is slightly different
    text = resp.output[0].content[0].text
    data = json.loads(text)
    return data
