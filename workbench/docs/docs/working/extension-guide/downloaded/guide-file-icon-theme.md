---
title: "Extension Guide: File Icon Theme"
---

# VS Code File Icon Theme Extension Guide

> Source: https://code.visualstudio.com/api/extension-guides/file-icon-theme

## Overview

Visual Studio Code displays icons throughout its interface next to filenames. Extensions can contribute custom file icon theme sets that users may select from their preferences.

## Extension Configuration

Add the `iconThemes` contribution point in `package.json`:

```json
{
  "contributes": {
    "iconThemes": [
      {
        "id": "turtles",
        "label": "Turtles",
        "path": "./fileicons/turtles-icon-theme.json"
      }
    ]
  }
}
```

**Key properties:**
- `id`: Unique identifier used in settings (must be readable and distinctive)
- `label`: Display name shown in the file icon theme picker
- `path`: Points to the JSON file defining your icon set

Files following the `*icon-theme.json` naming pattern receive completion support and hover hints in the editor.

## Icon Set File Structure

### Icon Definitions

The `iconDefinitions` section houses all icon specifications:

```json
{
  "iconDefinitions": {
    "_folder_dark": {
      "iconPath": "./images/Folder_16x_inverse.svg"
    }
  }
}
```

**Supported properties:**
- `iconPath`: Path to SVG or PNG image file
- `fontCharacter`: Character glyph to use from a font
- `fontColor`: Color applied to the glyph
- `fontSize`: Font size (relative percentage to parent)
- `fontId`: References a specific font

### File Associations

Icons associate with folders, folder names, files, extensions, file names, and language IDs:

```json
{
  "file": "_file_dark",
  "folder": "_folder_dark",
  "folderExpanded": "_folder_open_dark",
  "folderNames": {
    ".vscode": "_vscode_folder"
  },
  "fileExtensions": {
    "ini": "_ini_file"
  },
  "fileNames": {
    "win.ini": "_win_ini_file"
  },
  "languageIds": {
    "ini": "_ini_file"
  },
  "light": {
    "folderExpanded": "_folder_open_light",
    "folder": "_folder_light",
    "file": "_file_light",
    "fileExtensions": {
      "ini": "_ini_file_light"
    }
  },
  "highContrast": {}
}
```

**Association properties:**
- `file`: Default icon for files without matching extension, filename, or language ID
- `folder`: Icon for collapsed folders
- `folderExpanded`: Icon for expanded folders (defaults to `folder`)
- `folderNames`: Maps specific folder names to icons (case-insensitive)
- `folderNamesExpanded`: Maps folder names to icons when expanded
- `rootFolder`: Icon for collapsed workspace root folders
- `rootFolderExpanded`: Icon for expanded workspace root folders
- `rootFolderNames` / `rootFolderNamesExpanded`: Maps root folder names to icons
- `languageIds`: Associates language IDs to icons
- `fileExtensions`: Maps extensions to icons (case-insensitive; multi-dot support)
- `fileNames`: Maps complete filenames to icons (case-insensitive); strongest match priority

**Parent path segment prefixing:**

Keys can include a single parent path segment prefix:

```json
"fileNames": {
  "system/win.ini": "_win_ini_file"
}
```

**Match priority hierarchy:**
File name match with parent > file name match > file extension match with parent > file extension match > language match

### Font Definitions

```json
{
  "fonts": [
    {
      "id": "turtles-font",
      "src": [
        {
          "path": "./turtles.woff",
          "format": "woff"
        }
      ],
      "weight": "normal",
      "style": "normal",
      "size": "150%"
    }
  ],
  "iconDefinitions": {
    "_file": {
      "fontCharacter": "\\E002",
      "fontColor": "#5f8b3b",
      "fontId": "turtles-font"
    }
  }
}
```

## Advanced Features

### Hiding Explorer Arrows

```json
{
  "hidesExplorerArrows": true
}
```

### Language Default Icons

Language contributors may define icons within their language contribution:

```json
{
  "contributes": {
    "languages": [
      {
        "id": "latex",
        "icon": {
          "light": "./icons/latex-light.png",
          "dark": "./icons/latex-dark.png"
        }
      }
    ]
  }
}
```

Language icons display when:
- The file icon theme includes specific file icons (not generic only)
- No icon exists in the theme for the language, extension, or filename
- The theme does not set `"showLanguageModeIcons": false`

## Reference Examples

Built-in themes demonstrating implementation patterns include the Minimal and Seti themes in the VS Code repository.
