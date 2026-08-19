'use strict';

function listFavoriteProductIds(favorites, userId) {
  return favorites.filter((item) => item.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => item.productId);
}

function addFavorite(favorites, input) {
  const existing = favorites.find((item) => item.userId === input.userId && item.productId === input.productId);
  if (existing) return { favorite: existing, idempotent: true };
  const favorite = { id: input.id, userId: input.userId, productId: input.productId, createdAt: (input.now || new Date()).toISOString() };
  favorites.push(favorite);
  return { favorite, idempotent: false };
}

function removeFavorite(favorites, userId, productId) {
  const index = favorites.findIndex((item) => item.userId === userId && item.productId === productId);
  if (index < 0) return { removed: false, idempotent: true };
  favorites.splice(index, 1);
  return { removed: true, idempotent: false };
}

module.exports = { listFavoriteProductIds, addFavorite, removeFavorite };
