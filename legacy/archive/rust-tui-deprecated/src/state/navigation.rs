use crate::modules::ModuleCategory;
use std::collections::HashMap;

/// Navigation state for category/module tree view
#[derive(Debug, Clone)]
pub struct NavigationState {
    /// All available categories
    pub categories: Vec<ModuleCategory>,

    /// Current selected category index
    pub current_category_index: usize,

    /// Current selected module index within category
    pub current_module_index: usize,

    /// Track which categories are expanded (true) or collapsed (false)
    pub category_expanded: HashMap<ModuleCategory, bool>,

    /// Scroll offset for large lists
    pub scroll_offset: usize,

    /// Number of visible rows (set by UI based on terminal size)
    pub visible_rows: usize,
}

impl NavigationState {
    /// Create new navigation state with all categories expanded
    pub fn new() -> Self {
        let categories = vec![
            ModuleCategory::IAM,
            ModuleCategory::Security,
            ModuleCategory::Governance,
            ModuleCategory::Resources,
            ModuleCategory::Reporting,
            ModuleCategory::Settings,
        ];

        // Start with all categories expanded
        let mut category_expanded = HashMap::new();
        for cat in &categories {
            category_expanded.insert(*cat, true);
        }

        Self {
            categories,
            current_category_index: 0,
            current_module_index: 0,
            category_expanded,
            scroll_offset: 0,
            visible_rows: 20, // Default, will be updated by UI
        }
    }

    /// Get the currently selected category
    pub fn current_category(&self) -> ModuleCategory {
        self.categories[self.current_category_index]
    }

    /// Toggle category expansion state
    pub fn toggle_category(&mut self, category: ModuleCategory) {
        let expanded = self.category_expanded.get(&category).copied().unwrap_or(true);
        self.category_expanded.insert(category, !expanded);
    }

    /// Toggle current category expansion
    pub fn toggle_current_category(&mut self) {
        let cat = self.current_category();
        self.toggle_category(cat);
    }

    /// Check if category is expanded
    pub fn is_category_expanded(&self, category: ModuleCategory) -> bool {
        self.category_expanded.get(&category).copied().unwrap_or(true)
    }

    /// Move to next category
    pub fn next_category(&mut self) {
        if self.current_category_index < self.categories.len() - 1 {
            self.current_category_index += 1;
            self.current_module_index = 0; // Reset module index
        }
    }

    /// Move to previous category
    pub fn prev_category(&mut self) {
        if self.current_category_index > 0 {
            self.current_category_index -= 1;
            self.current_module_index = 0; // Reset module index
        }
    }

    /// Move to next module within category
    pub fn next_module(&mut self, module_count: usize) {
        if module_count > 0 && self.current_module_index < module_count - 1 {
            self.current_module_index += 1;
        }
    }

    /// Move to previous module within category
    pub fn prev_module(&mut self) {
        if self.current_module_index > 0 {
            self.current_module_index -= 1;
        }
    }

    /// Jump to specific category by index
    pub fn jump_to_category(&mut self, index: usize) {
        if index < self.categories.len() {
            self.current_category_index = index;
            self.current_module_index = 0;
        }
    }

    /// Expand all categories
    #[allow(dead_code)] // Scaffolding for future keyboard shortcut
    pub fn expand_all(&mut self) {
        for cat in &self.categories {
            self.category_expanded.insert(*cat, true);
        }
    }

    /// Collapse all categories
    #[allow(dead_code)] // Scaffolding for future keyboard shortcut
    pub fn collapse_all(&mut self) {
        for cat in &self.categories {
            self.category_expanded.insert(*cat, false);
        }
    }

    /// Update scroll offset based on selected index and visible rows
    #[allow(dead_code)] // Scaffolding for future scrolling feature
    pub fn update_scroll(&mut self, selected_index: usize) {
        if selected_index >= self.scroll_offset + self.visible_rows {
            self.scroll_offset = selected_index - self.visible_rows + 1;
        } else if selected_index < self.scroll_offset {
            self.scroll_offset = selected_index;
        }
    }
}

impl Default for NavigationState {
    fn default() -> Self {
        Self::new()
    }
}
