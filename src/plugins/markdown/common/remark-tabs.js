import { visit } from 'unist-util-visit';

let tabGroupCounter = 0;

export function remarkTabs() {
  return (tree, file) => {
    tabGroupCounter = 0;

    visit(tree, 'containerDirective', (node, index, parent) => {
      if (node.name !== 'tabs') return;

      const tabGroupId = `tab-group-${tabGroupCounter++}`;
      const tabs = [];
      const tabContents = [];
      const errors = [];

      let currentTabName = null;
      let currentContent = [];

      // Check for empty container
      if (!node.children || node.children.length === 0) {
        errors.push('Empty tabs container');
      }

      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'leafDirective' && child.name === 'tab') {
            // Save previous tab if exists
            if (currentTabName !== null) {
              tabs.push(currentTabName);
              tabContents.push([...currentContent]);
            }

            // Get tab title
            currentTabName = '';
            if (child.children && child.children.length > 0) {
              currentTabName = child.children
                .map(c => c.value || (c.children ? c.children.map(cc => cc.value || '').join('') : ''))
                .join('');
            }

            // Error if tab has no title
            if (!currentTabName.trim()) {
              errors.push(`Tab ${tabs.length + 1} has no title`);
              currentTabName = `Tab ${tabs.length + 1}`;
            }

            currentContent = [];
          } else if (currentTabName !== null) {
            currentContent.push(child);
          }
        }

        // Don't forget the last tab
        if (currentTabName !== null) {
          tabs.push(currentTabName);
          tabContents.push([...currentContent]);
        }
      }

      // Check for missing tabs
      if (tabs.length === 0) {
        errors.push('No ::tab directives found inside :::tabs');
      }

      // Check for single tab
      if (tabs.length === 1) {
        errors.push('Only one tab found - consider using regular content');
      }

      // Check for empty tab content
      tabContents.forEach((content, i) => {
        if (content.length === 0) {
          errors.push(`Tab "${tabs[i]}" has no content`);
        }
      });

      // If critical errors, render as error block
      if (tabs.length === 0 || !node.children || node.children.length === 0) {
        console.error(`[remark-tabs] ${errors.join('; ')}`);
        
        node.data = node.data || {};
        node.data.hName = 'div';
        node.data.hProperties = { class: 'tabs-error' };
        node.children = [
          {
            type: 'html',
            value: `<div class="tabs-error-header">WARNING: Tabs Error</div>
                    <ul class="tabs-error-list">
                      ${errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}
                    </ul>
                    <pre class="tabs-error-source">${escapeHtml(getSourceText(node))}</pre>`
          }
        ];
        return;
      }

      // Log non-critical warnings
      if (errors.length > 0) {
        console.warn(`[remark-tabs] Warnings: ${errors.join('; ')}`);
      }

      // Build the structure
      node.data = node.data || {};
      node.data.hName = 'div';
      node.data.hProperties = { class: 'tabs-container', 'data-tab-group': tabGroupId };

      // Build tab buttons HTML
      let headerHTML = '<div class="tabs-header">';
      tabs.forEach((title, index) => {
        const checked = index === 0 ? 'checked' : '';
        const safeTitle = escapeHtml(title);
        headerHTML += `<input type="radio" name="${tabGroupId}" id="${tabGroupId}-${index}" class="tab-radio" ${checked}/>`;
        headerHTML += `<label for="${tabGroupId}-${index}" class="tab-button">${safeTitle}</label>`;
      });
      headerHTML += '</div>';

      // Create content panels
      const panelNodes = tabContents.map((content, index) => ({
        type: 'parent',
        data: {
          hName: 'div',
          hProperties: {
            class: index === 0 ? 'tab-content tab-content-active' : 'tab-content',
            'data-tab-index': String(index)
          }
        },
        children: content
      }));

      // Final structure
      node.children = [
        {
          type: 'html',
          value: headerHTML
        },
        {
          type: 'parent',
          data: {
            hName: 'div',
            hProperties: { class: 'tabs-body' }
          },
          children: panelNodes
        }
      ];
    });
  };
}

// Helper to escape HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

// Helper to reconstruct source text for error display
function getSourceText(node) {
  let text = ':::tabs\n';
  
  if (node.children) {
    for (const child of node.children) {
      if (child.type === 'leafDirective' && child.name === 'tab') {
        const title = child.children?.map(c => c.value || '').join('') || '';
        text += `::tab[${title}]\n`;
      } else if (child.type === 'paragraph' && child.children) {
        text += child.children.map(c => c.value || '').join('') + '\n';
      } else if (child.type === 'text') {
        text += child.value + '\n';
      }
    }
  }
  
  text += ':::';
  return text;
}

export default remarkTabs;

