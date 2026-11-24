function cents(value) {
  return Math.round(Number(value) * 100);
}
function discountedCents(baseCents, percent = 0) {
  return Math.round((baseCents * (100 - Number(percent))) / 100);
}
function personalizedPrice(service, coupon) {
  const base = cents(service.final_price);
  const percent = Number(coupon?.discount_percent || 0);
  return {
    ...service,
    service_price: base / 100,
    final_price: discountedCents(base, percent) / 100,
    coupon_name: coupon?.name || null,
    coupon_percent: percent,
  };
}
module.exports = { cents, discountedCents, personalizedPrice };
