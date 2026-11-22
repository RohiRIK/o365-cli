use crate::modules::MODULE_REGISTRY;
use crate::state::{AppState, FocusState};
use crate::ui::styles::{Styles, ICON_ARROW_DOWN, ICON_ARROW_RIGHT};
use ratatui::{
    buffer::Buffer,
    layout::Rect,
    widgets::{Block, Borders, List, ListItem, Widget},
};

/// Renders the module tree view with collapsible categories
/// Shows categories in the left sidebar and modules in the right pane
pub fn render_module_tree(state: &AppState, area: Rect, buf: &mut Buffer) {
    let is_focused = matches!(state.focus, FocusState::CategoryTree | FocusState::ModuleList);

    // Build list items for tree view
    let mut items = Vec::new();

    // Lock the registry to access module data
    let registry = MODULE_REGISTRY.lock().unwrap();

    for (cat_idx, category) in state.navigation.categories.iter().enumerate() {
        let is_expanded = state.navigation.category_expanded.get(category).copied().unwrap_or(false);
        let is_current_cat = cat_idx == state.navigation.current_category_index;

        // Category header
        let arrow = if is_expanded { ICON_ARROW_DOWN } else { ICON_ARROW_RIGHT };
        let modules = registry.modules_by_category(*category);
        let count = modules.len();

        let category_text = format!("{} {} ({})", arrow, category.to_string(), count);

        let style = if is_current_cat && matches!(state.focus, FocusState::CategoryTree) {
            Styles::selected()
        } else if is_expanded {
            Styles::category_expanded()
        } else {
            Styles::category_collapsed()
        };

        items.push(ListItem::new(category_text).style(style));

        // Show modules if expanded
        if is_expanded {
            for (mod_idx, module) in modules.iter().enumerate() {
                let is_current_mod = is_current_cat && mod_idx == state.navigation.current_module_index;

                // Removed enabled/disabled icons - all modules shown equally
                let module_text = format!("  {}", &module.display_name);

                let style = if is_current_mod && matches!(state.focus, FocusState::ModuleList) {
                    Styles::selected()
                } else {
                    Styles::default()
                };

                items.push(ListItem::new(module_text).style(style));
            }
        }
    }

    // Create the list widget
    let border_style = if is_focused {
        Styles::border_focused()
    } else {
        Styles::border()
    };

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(border_style)
        .title(" Modules ");

    let list = List::new(items).block(block);

    list.render(area, buf);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_module_tree_renders() {
        // Basic smoke test - ensure no panics
        let state = AppState::new();
        let area = Rect::new(0, 0, 50, 30);
        let mut buf = Buffer::empty(area);

        render_module_tree(&state, area, &mut buf);
        // If we get here without panic, the test passes
    }
}
