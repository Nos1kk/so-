(function () {
  "use strict";

  const STATUS = {
    pending: {
      label: "Заявка оформлена",
      tone: "new"
    },
    confirmed: {
      label: "Заказ подтверждён",
      tone: "progress"
    },
    new: {
      label: "Новый",
      tone: "new"
    },
    processing: {
      label: "В обработке",
      tone: "progress"
    },
    paid: {
      label: "Оплачен",
      tone: "progress"
    },
    assembling: {
      label: "Собирается",
      tone: "progress"
    },
    delivering: {
      label: "Передан в доставку",
      tone: "progress"
    },
    arrived: {
      label: "Заказ прибыл",
      tone: "progress"
    },
    received: {
      label: "Получен клиентом",
      tone: "done"
    },
    completed: {
      label: "Доставлен",
      tone: "done"
    },
    canceled: {
      label: "Отменён",
      tone: "muted"
    },
    return: {
      label: "Возврат",
      tone: "muted"
    }
  };

  function normalize(order) {
    const status = order?.status && STATUS[order.status] ? order.status : "delivering";

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
