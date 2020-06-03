let shouldOptimize: boolean;
shouldOptimize = true;

import {
  convertPxToTailwindAttr,
  mapWidthHeightSize,
} from "./tailwind_wrappers";

export const rowColumnProps = (
  node: FrameNode | ComponentNode | InstanceNode
): string => {
  // ROW or COLUMN

  // [optimization]
  // flex, by default, has flex-row. Therefore, it can be omitted.
  const flexRow = shouldOptimize ? "" : "flex-row ";

  let rowOrColumn = node.layoutMode === "HORIZONTAL" ? flexRow : "flex-col ";

  // https://tailwindcss.com/docs/space/
  // space between items
  const spacing = convertPxToTailwindAttr(node.itemSpacing, mapWidthHeightSize);
  const spaceDirection = node.layoutMode === "HORIZONTAL" ? "x" : "y";

  // space is visually ignored when there are less than two children
  let space =
    shouldOptimize && node.children.length < 2
      ? ""
      : `space-${spaceDirection}-${spacing} `;

  // align according to the most frequent way the children are aligned.
  // todo layoutAlign should go to individual fields and this should be threated as an optimization
  // const layoutAlign =
  //   mostFrequentString(node.children.map((d) => d.layoutAlign)) === "MIN"
  //     ? ""
  //     : "items-center ";

  // [optimization]
  // when all children are STRETCH and layout is Vertical, align won't matter. Otherwise, item-center.
  const layoutAlign =
    node.layoutMode === "VERTICAL" &&
    node.children.every((d) => d.layoutAlign === "STRETCH")
      ? ""
      : "items-center ";

  // if parent is a Frame with AutoLayout set to Vertical, the current node should expand
  const flex =
    node.parent &&
    "layoutMode" in node.parent &&
    node.parent.layoutMode === node.layoutMode
      ? "flex "
      : "inline-flex ";

  if (
    node.children.length === 1 &&
    "layoutMode" in node.children[0] &&
    node.children[0].layoutMode !== "NONE"
  ) {
    return "";
  }

  if (
    node.children.length === 1 &&
    node.children[0].layoutAlign === "STRETCH"
  ) {
    return "";
  }

  return `${flex}${rowOrColumn}${space}${layoutAlign}`;
};

export const magicMargin = 32;

// makes the view size bigger when there is a stroke
const getNodeSizeWithStrokes = (
  node:
    | DefaultFrameMixin // Frame
    | (BaseNodeMixin & LayoutMixin & ChildrenMixin) // Group
    | DefaultShapeMixin // Shapes
): Array<number> => {
  let nodeHeight = node.height;
  let nodeWidth = node.width;

  // tailwind doesn't support OUTSIDE or CENTER, only INSIDE.
  // Therefore, to give the same feeling, the height and width will be slighly increased.
  // node.strokes.lenght is necessary because [strokeWeight] can exist even without strokes.
  if ("strokes" in node && node.strokes.length) {
    if (node.strokeAlign === "OUTSIDE") {
      nodeHeight += node.strokeWeight * 2;
      nodeWidth += node.strokeWeight * 2;
    } else if (node.strokeAlign === "CENTER") {
      nodeHeight += node.strokeWeight * 1.5;
      nodeWidth += node.strokeWeight * 1.5;
    }
  }

  if ("children" in node) {
    // if any children has an OUTSIDE or CENTER stroke and, with that stroke,
    // the child gets a size bigger than parent, adjust parent to be larger
    node.children
      .filter((d) => "strokeWeight" in d && d.strokes.length)
      .forEach((d) => {
        if ("strokeWeight" in d) {
          if (d.strokeAlign === "OUTSIDE") {
            if (nodeWidth < d.width + d.strokeWeight * 2) {
              nodeWidth += d.strokeWeight * 2;
            }
            if (nodeHeight < d.height + d.strokeWeight * 2) {
              nodeHeight += d.strokeWeight * 2;
            }
          } else if (d.strokeAlign === "CENTER") {
            if (nodeWidth < d.width + d.strokeWeight * 1.5) {
              nodeWidth += d.strokeWeight * 2;
            }
            if (nodeHeight < d.height + d.strokeWeight * 1.5) {
              nodeHeight += d.strokeWeight * 1.5;
            }
          }
        }
      });
  }

  return [nodeWidth, nodeHeight];
};

export const getContainerSizeProp = (
  node:
    | DefaultFrameMixin // Frame
    | (BaseNodeMixin & LayoutMixin & ChildrenMixin) // Group
    | DefaultShapeMixin // Shapes
): string => {
  /// WIDTH AND HEIGHT

  // if parent is a page, width can't get past w-64, therefore let it be free
  // h-screen is necessary
  if (node.parent?.type === "PAGE" && node.width > 400) {
    return "";
  }

  // if layoutAlign is STRETCH, w/h should be full
  if (node.layoutAlign === "STRETCH") {
    if (node.parent && "layoutMode" in node.parent && "layoutMode" in node) {
      if (node.parent.layoutMode === node.layoutMode) {
        return "";
      }
    }
  }

  // when parent is HORIZONTAL and child is HORIZONTAL, let the child define the size
  if (node.parent && "layoutMode" in node.parent && "layoutMode" in node) {
    if (
      node.layoutMode !== "NONE" &&
      node.parent.layoutMode === node.layoutMode
    ) {
      return "";
    }
  }

  const [nodeWidth, nodeHeight] = getNodeSizeWithStrokes(node);

  const hRem = convertPxToTailwindAttr(nodeHeight, mapWidthHeightSize);
  const wRem = convertPxToTailwindAttr(nodeWidth, mapWidthHeightSize);

  let propHeight = `h-${hRem} `;
  let propWidth = `w-${wRem} `;

  // if node is too big for tailwind to handle, just let it be full
  if (
    node.width > 256 &&
    "children" in node &&
    Math.max(...node.children.map((d) => d.width)) > 256
  ) {
    propWidth = "w-full ";
  }

  if (node.parent && "width" in node.parent) {
    // compare if width is same as parent, with a small threshold
    if (node.parent.width - node.width < 2) {
      propWidth = "w-full ";
    }

    // compare if height is same as parent, with a small threshold
    // commented because h-auto is better than h-full most of the time on responsiviness
    // todo improve this. Buggy in small layouts, good in big.
    if (node.parent.height - node.height < 2 && node.height > 256) {
      // propHeight = "h-full ";
      propHeight = "";
    }

    // 799 / 400 - 2 = -0,0025
    // 0.01 of tolerance is enough for 5% of diff, i.e.: 804 / 400
    if (Math.abs(node.parent.width / node.width - 2) < 0.01) {
      propWidth = "w-1/2 ";
    }
  }

  // when the child has the same size as the parent, don't set the size of the parent (twice)
  // exception: when it is 1/2
  if (
    "children" in node &&
    node.children.length === 1 &&
    propWidth !== "w-1/2 "
  ) {
    const child = node.children[0];
    if (child.width === node.width && child.height === node.height) {
      return "";
    }
  } else {
    // if (!("strokes" in node)) {
    //   // ignore Group
    //   return "";
    // }
  }

  if (node.parent !== null && "width" in node.parent) {
    // set the width to max if the view is near the corner
    // that will be complemented with margins from [retrieveContainerPosition]
    // the third check [parentWidth - nodeWidth >= 2 * magicMargin]
    // was made to avoid setting h-full when parent is almost the same size as children

    // nodeWidth / node.parent.width >= 0.8: this means only when it covers 80% of the frame
    if (
      node.x - node.parent.x <= magicMargin &&
      nodeWidth / node.parent.width >= 0.8 &&
      nodeWidth + 2 * magicMargin >= node.parent.width &&
      node.parent.width - nodeWidth >= 2 * magicMargin
    ) {
      propWidth = "w-full ";
    }

    if (
      node.y - node.parent.y <= magicMargin &&
      nodeHeight / node.parent.height >= 0.8 &&
      nodeHeight + 2 * magicMargin >= node.parent.height &&
      node.parent.height - nodeHeight >= 2 * magicMargin
    ) {
      propHeight = "h-full ";
    }
  }
  console.log("entrou aqui ->", propHeight);

  if ("layoutMode" in node) {
    // if counterAxisSizingMode === "AUTO", width and height won't be set. For every other case, it will be.
    if (node.counterAxisSizingMode === "FIXED") {
      // when AutoLayout is HORIZONTAL, width is set by Figma and height is auto.
      if (node.layoutMode === "HORIZONTAL") {
        return `${propHeight}`;
      } else if (node.layoutMode === "VERTICAL") {
        // when AutoLayout is VERTICAL, height is set by Figma and width is auto.
        return `${propWidth}`;
      }
      return `${propWidth}${propHeight}`;
    } else {
      // exception, override it when this is detected
      if (propWidth === "w-1/2 ") {
        return `${propWidth}`;
      }
    }
  } else {
    return `${propWidth}${propHeight}`;
  }
  console.log("saiu aqui");

  return "";
};