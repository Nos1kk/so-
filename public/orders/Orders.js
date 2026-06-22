(function () {
  "use strict";

  const STATUS = {
    pending: {
      label: "Заявка получена",
      tone: "new"
    },
    confirmed: {
      label: "Подтверждён",
      tone: "progress"
    },
    assembling: {
      label: "Комплектуется",
      tone: "progress"
    },
    delivering: {
      label: "В пути",
      tone: "progress"
    },
    arrived: {
      label: "Прибыл",
      tone: "progress"
    },
    received: {
      label: "Получен",
      tone: "done"
    },
    canceled: {
      label: "Отменён",
      tone: "muted"
    }
  };

  const LEGACY_STATUS = {
    new: "pending",
    processing: "confirmed",
    paid: "confirmed",
    completed: "received",
    return: "canceled"
  };

  function normalize(order) {
    const status = STATUS[order?.status]
      ? order.status
      : (LEGACY_STATUS[order?.status] || "pending");

    return {
      ...order,
      status,
      items: Array.isArray(order?.items) ? order.items : []
    };
  }

  function statusLabel(order) {
    return STATUS[normalize(order).status].label;
  }

  function statusTone(order) {
    return STATUS[normalize(order).status].tone;
  }

  function isCompleted(order) {
    return ["received", "completed"].includes(normalize(order).status);
  }

  function hasReview(reviews, orderId, productId) {
    return (Array.isArray(reviews) ? reviews : []).some((review) => (
      review.orderId === orderId && review.productId === productId
    ));
  }

  function reviewableItems(orders, reviews, byId) {
    const rows = [];

    (Array.isArray(orders) ? orders : []).forEach((rawOrder) => {
      const order = normalize(rawOrder);
      if (!isCompleted(order)) return;

      order.items.forEach((item) => {
        const product = byId?.(item.id);
        if (!product || hasReview(reviews, order.id, item.id)) return;

        rows.push({ order, item, product });
      });
    });

    return rows;
  }

  function completedOrders(orders) {
    return (Array.isArray(orders) ? orders : []).filter(isCompleted);
  }

  window.SonaOrders = {
    STATUS,
    normalize,
    statusLabel,
    statusTone,
    isCompleted,
    hasReview,
    reviewableItems,
    completedOrders
  };
})();
