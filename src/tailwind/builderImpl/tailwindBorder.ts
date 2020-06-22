import { AltSceneNode } from "../../common/altMixins";
import { nearestValue, pxToBorderRadius } from "../conversionTables";
import { AltGeometryMixin } from "../../common/altMixins";

/**
 * https://tailwindcss.com/docs/border-width/
 * example: border-2
 */
export const tailwindBorderWidth = (node: AltGeometryMixin): string => {
  // [node.strokeWeight] can have a value even when there are no strokes
  // [when testing] node.effects can be undefined
  if (node.strokes && node.strokes.length > 0 && node.strokeWeight > 0) {
    const array = [1, 2, 4, 8];
    const nearest = nearestValue(node.strokeWeight, array);
    if (nearest === 1) {
      // special case
      return "border ";
    } else {
      return `border-${nearest} `;
    }
  }
  return "";
};

/**
 * https://tailwindcss.com/docs/border-radius/
 * example: rounded-sm
 * example: rounded-tr-lg
 */
export const tailwindBorderRadius = (node: AltSceneNode): string => {
  if (node.type === "ELLIPSE") {
    return "rounded-full ";
  } else if (
    (!("cornerRadius" in node) && !("topLeftRadius" in node)) ||
    (node.cornerRadius === figma.mixed && node.topLeftRadius === undefined) ||
    node.cornerRadius === 0
  ) {
    // the second condition is used on tests. On Figma, topLeftRadius is never undefined.
    // ignore when 0, undefined or non existent
    return "";
  }

  let comp = "";

  if (node.cornerRadius !== figma.mixed) {
    comp += `rounded${pxToBorderRadius(node.cornerRadius)} `;
  } else if (node.topLeftRadius !== undefined) {
    // todo optimize for tr/tl/br/bl instead of t/r/l/b
    if (node.topLeftRadius !== 0) {
      comp += `rounded-tl${pxToBorderRadius(node.topLeftRadius)} `;
    }
    if (node.topRightRadius !== 0) {
      comp += `rounded-tr${pxToBorderRadius(node.topRightRadius)} `;
    }
    if (node.bottomLeftRadius !== 0) {
      comp += `rounded-bl${pxToBorderRadius(node.bottomLeftRadius)} `;
    }
    if (node.bottomRightRadius !== 0) {
      comp += `rounded-br${pxToBorderRadius(node.bottomRightRadius)} `;
    }
  }

  return comp;
};