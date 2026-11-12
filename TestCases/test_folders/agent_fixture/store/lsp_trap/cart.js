// Unrelated shopping cart. Its addItem is NOT the store's addItem: a rename of the store method must not touch this file.
export const cart = {
  lines: [],
  addItem(sku, qty) {
    this.lines.push({ sku, qty });
  },
};

cart.addItem("sku-1", 2);
