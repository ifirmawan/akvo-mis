/**
 * Color utility functions for map markers and data visualization
 * Provides unique, scalable color generation for any dataset size
 */

/**
 * Generate a color variation by modifying HSL values
 * @param {string} baseColor - Base color in hex format
 * @param {number} variation - Variation number for uniqueness
 * @returns {string} Modified color in hex format
 */
export const generateVariation = (baseColor, variation) => {
  // Convert hex to RGB
  const hex = baseColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  // Convert RGB to HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  // Modify the color based on variation
  // Adjust hue by 30 degrees per variation, ensure it stays within [0, 1]
  h = (h + variation * 0.083) % 1; // 30/360 = 0.083

  // Slightly adjust saturation and lightness for more variation
  s = Math.min(1, Math.max(0, s + (variation % 2 === 0 ? 0.1 : -0.1)));
  l = Math.min(0.9, Math.max(0.1, l + (variation % 3 === 0 ? 0.1 : -0.05)));

  // Convert HSL back to RGB
  const hue2rgb = (p, q, t) => {
    if (t < 0) {
      t += 1;
    }
    if (t > 1) {
      t -= 1;
    }
    if (t < 1 / 6) {
      return p + (q - p) * 6 * t;
    }
    if (t < 1 / 2) {
      return q;
    }
    if (t < 2 / 3) {
      return p + (q - p) * (2 / 3 - t) * 6;
    }
    return p;
  };

  let newR, newG, newB;
  if (s === 0) {
    newR = newG = newB = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    newR = hue2rgb(p, q, h + 1 / 3);
    newG = hue2rgb(p, q, h);
    newB = hue2rgb(p, q, h - 1 / 3);
  }

  // Convert back to hex
  const toHex = (c) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
};

/**
 * Generate colors specifically for map markers with better contrast
 * @param {number} count - Number of colors needed
 * @returns {Array<string>} Array of hex color codes optimized for map markers
 */
export const forMarker = (count = 0) => {
  if (count <= 0) {
    return [];
  }

  // For map markers, we want high contrast and visibility
  const mapOptimizedSchemes = [
    "#e41a1c",
    "#377eb8",
    "#4daf4a",
    "#984ea3",
    "#ff7f00",
    "#ffff33",
    "#a65628",
    "#f781bf",
    "#999999",
    "#66c2a5",
    "#fc8d62",
    "#8da0cb",
    "#e78ac3",
    "#a6d854",
    "#ffd92f",
    "#e5c494",
    "#b3b3b3",
    "#8dd3c7",
    "#ffffb3",
    "#bebada",
    "#fb8072",
    "#80b1d3",
    "#fdb462",
    "#b3de69",
    "#fccde5",
    "#d9d9d9",
    "#bc80bd",
    "#ccebc5",
    "#ffed6f",
  ];

  // If we need more colors than available, generate additional unique colors
  if (count > mapOptimizedSchemes.length) {
    const baseColors = [...mapOptimizedSchemes];
    const additionalColorsNeeded = count - mapOptimizedSchemes.length;

    // Generate additional unique colors by modifying existing ones
    for (let i = 0; i < additionalColorsNeeded; i++) {
      const baseColor = mapOptimizedSchemes[i % mapOptimizedSchemes.length];
      const modifiedColor = generateVariation(baseColor, i + 1);
      baseColors.push(modifiedColor);
    }

    return baseColors;
  }

  return mapOptimizedSchemes.slice(0, count);
};
