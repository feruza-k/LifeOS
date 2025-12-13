# categories.py
# Category utilities and color mappings

from app.storage.repo import repo

# Legacy category colors (for backward compatibility)
CATEGORY_COLORS = {
    "health": "#C7DED5",  # Muted Sage
    "work": "#DCD0E6",  # Lavender Mist
    "personal": "#F4D6E4",  # Dusty Rose
    "social": "#DCD0E6",  # Lavender Mist
    "travel": "#F0E0D6",  # Soft Peach
    "errands": "#FFF5E0",  # Creamy Yellow
    "study": "#C9DCEB",  # Pale Sky
    "growth": "#C9DCEB",  # Pale Sky
    "family": "#F4D6E4",  # Dusty Rose
    "creativity": "#FFF5E0",  # Creamy Yellow
    "default": "#EBEBEB"  # Cloud Grey
}

def get_category_colors():
    """
    Get category color mapping.
    Returns stored categories as a dict, or falls back to legacy colors.
    """
    categories = repo.get_categories()
    if categories:
        # Convert categories list to color mapping dict
        return {cat["id"]: cat["color"] for cat in categories}
    return CATEGORY_COLORS

def get_category_color(category_id: str) -> str:
    """Get color for a specific category ID."""
    category = repo.get_category(category_id)
    if category:
        return category.get("color", CATEGORY_COLORS.get(category_id, "#EBEBEB"))
    return CATEGORY_COLORS.get(category_id, "#EBEBEB")
