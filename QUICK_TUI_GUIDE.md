# O365-CLI TUI Quick Guide

## Navigation Basics

### Focus System
The TUI has 4 focus areas that you cycle through with Tab:
1. **CategoryTree** (left sidebar) - Navigate categories
2. **ModuleList** (right pane) - Select and run modules  
3. **SettingsDashboard** - Configure settings
4. **Logs** - View execution logs

### Key Mappings

**Global Keys:**
- `Tab` - Cycle focus forward
- `Shift+Tab` - Cycle focus backward  
- `q` / `Ctrl+C` - Quit app

**When Focus = CategoryTree (Left Sidebar):**
- `j` / `Down` - Next category
- `k` / `Up` - Previous category
- `Enter` - Expand/collapse category
- `Right Arrow` - Move focus to ModuleList
- `1-6` - Jump to category by number

**When Focus = ModuleList (Right Pane):**
- `j` / `Down` - Next module
- `k` / `Up` - Previous module
- `Enter` - **RUN THE MODULE** (or show input modal)
- `Left Arrow` - Move focus back to CategoryTree
- `i` - Show module details

## Common Workflow

1. Start app: `./cli/target/release/o365-cli`
2. Use `j/k` to navigate categories (focus starts on left)
3. Press `Right Arrow` or `Tab` to move to module list
4. Use `j/k` to select a module
5. Press `Enter` to execute
6. If module needs inputs, fill them out and press `Enter`
7. View results in the module details pane

## Visual Focus Indicators

- CategoryTree focus: Left sidebar has highlighted border
- ModuleList focus: Right pane has highlighted border
- Module highlighting (yellow) does NOT mean that pane has focus!

## Troubleshooting

**"I press Enter and nothing happens"**
- Check which pane has focus (look for highlighted border)
- Press `Right Arrow` or `Tab` to move focus to ModuleList
- Then press `Enter` to run the selected module

**"Module says not implemented"**
- Check modules.toml - module might have `supported = false`
- Re-build with: `cargo build --release --manifest-path cli/Cargo.toml`
