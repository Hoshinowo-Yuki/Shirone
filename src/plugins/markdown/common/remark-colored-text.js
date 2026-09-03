import { visit } from 'unist-util-visit';

const COLORS = {
  // Basic colors
  red: '#ef4444',
  pink: '#ec4899',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  teal: '#14b8a6',
  blue: '#3b82f6',
  purple: '#a855f7',
  gray: '#6b7280',
  grey: '#6b7280',
};

export function remarkColoredText() {
  return (tree) => {
    visit(tree, 'textDirective', (node) => {
      const colorName = node.name.toLowerCase();
      const colorValue = COLORS[colorName];

      // Check if it's a known color or a valid hex/rgb
      const finalColor = colorValue || parseCustomColor(colorName);

      if (!finalColor) return;

      // Get the text content
      const text = node.children
        ?.map(c => c.value || '')
        .join('') || '';

      node.data = node.data || {};
      node.data.hName = 'span';
      node.data.hProperties = {
        style: `color: ${finalColor}`,
        class: 'colored-text'
      };
    });
  };
}

// Allow custom hex colors like :hex-ff5733[text]
function parseCustomColor(name) {
  // Match hex- prefix: hex-ff5733
  const hexMatch = name.match(/^hex-([a-f0-9]{3,6})$/i);
  if (hexMatch) {
    return `#${hexMatch[1]}`;
  }

  // Could also support rgb in future
  return null;
}

export default remarkColoredText;

