(function () {
  "use strict";

  function list(reviews, productId) {
    return (Array.isArray(reviews) ? reviews : [])
      .filter((review) => review.productId === productId && ["published", ""].includes(review.status || ""))
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  }

  function all(reviews) {
    return (Array.isArray(reviews) ? reviews : [])
      .slice()
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  }

  function summary(reviews, productId) {
    const productReviews = list(reviews, productId);
    const count = productReviews.length;
    const average = count
      ? productReviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / count
      : 0;

    return {
      count,
      average: Math.round(average * 10) / 10,
      label: count ? `${Math.round(average * 10) / 10} ★ · ${count} оценок` : "0 отзывов"
    };
  }

  function displayMoment(review) {
    const source = Number(review?.createdAt) || Date.parse(review?.date || "");
    if (!source) return review?.date || "";

    return new Date(source).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function hasReview(reviews, orderId, productId) {
    return (Array.isArray(reviews) ? reviews : []).some((review) => (
      review.orderId === orderId && review.productId === productId
    ));
  }

  function authorName(profile) {
    const name = String(profile?.name || "").trim();
    if (name) return name;

    const email = String(profile?.email || "").trim();
    if (email) return email.split("@")[0] || "Пользователь";

    return "Пользователь";
  }

  function create({ orderId, productId, rating, text, profile }) {
    const now = Date.now();

    return {
      id: `REVIEW-${now}-${Math.random().toString(16).slice(2, 7)}`,
      orderId,
      productId,
      rating: Math.min(5, Math.max(1, Number(rating) || 5)),
      text: String(text || "").trim().slice(0, 600),
      author: authorName(profile),
      date: new Date(now).toLocaleDateString("ru-RU", { day: "2-digit", month: "long" }),
      time: new Date(now).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      status: "moderation",
      verified: false,
      reply: "",
      createdAt: now
    };
  }

  window.SonaReviews = {
    list,
    all,
    summary,
    displayMoment,
    hasReview,
    create
  };
})();
