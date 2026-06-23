export const receivedAt = new Date("2026-06-23T14:00:00-05:00");

export const ordered = {
  id: "ordered-1",
  subject: 'Ordered: "Insulated Backpack Cooler..."',
  receivedAt,
  body: `Thanks for your order!
Arriving tomorrow
Family - NORTH TEXAS, TX
Order # \u202a112-0000000-0000001
View or edit order
Insulated Backpack Cooler, Leak Proof 33 Cans, Portable Lightweight Beach Travel Bag
Insulated Backpack Cooler...
Quantity: 1
$33.99
Grand Total: $36.79`,
};

export const shipped = {
  id: "shipped-1",
  subject: 'Shipped: "Rechargeable Handheld Fan..."',
  receivedAt,
  body: `Your package was shipped!
Family - NORTH TEXAS, TX
Order # 112-0000000-0000002
Track package
Rechargeable Handheld Mini Fan with Power Bank and Flashlight
Rechargeable Handheld Mini Fan...
Quantity: 1
$13.07
Total $15.48`,
};

export const delivered = {
  id: "delivered-1",
  subject: 'Delivered: "Rechargeable Handheld Fan..." and 1 more item',
  receivedAt,
  body: `Your package was delivered!
Delivered today
Family - NORTH TEXAS, TX
Order # 112-0000000-0000002
Track package
Rechargeable Handheld Mini Fan with Power Bank and Flashlight for Travel
Personal Cooling System with Fan, Cooling Plate and Dry-Touch Mist
info icon Return or replace items in Your Orders.`,
};

export const returnRequested = {
  id: "return-1",
  subject: "Return request confirmed for Smart Home Presence Sensor...",
  receivedAt,
  body: `Hello Customer,
Your return request is confirmed.
Drop off by
Sat, Jun 27
Dropoff location
Any UPS Dropoff location
Item(s) in your return request
[Smart Home Presence Sensor Wireless 5-zone System](https://www.amazon.com/gp/product/B000TEST01?ref_=E_SonarPREPReturnSummary_Asin_Title)
Quantity: 1
Order # 112-0000000-0000003
Refund subtotal $54.11
Total estimated refund* $54.11
$54.11 to your Visa ending in 0000`,
};

export const dropoff = {
  id: "dropoff-1",
  subject: "Dropoff confirmed for MMO Gaming Mouse...",
  receivedAt,
  body: `Dropoff confirmed.
Your return is in-transit.
Refund will be issued by Jun 30.
Refund subtotal $31.38
Total estimated refund* $31.38
$31.38 to your Visa ending in 0000
Item(s) in your return request
[MMO Gaming Mouse with Programmable Buttons](https://www.amazon.com/gp/product/B000TEST02?ref_=E_ReturnDropOffReceived_Asin_Title)
Quantity: 1
Order # 112-0000000-0000004`,
};

export const refundIssued = {
  id: "refund-1",
  subject: "Advance refund issued for MMO Gaming Mouse...",
  receivedAt,
  body: `Your refund was issued.
$31.38 will be credited to your Visa by Jun 26.
Return summary
Refund subtotal $31.38
Total refund* $31.38
Refund method
$31.38 to your Visa ending in 0000
Item(s) in your return request
[MMO Gaming Mouse with Programmable Buttons](https://www.amazon.com/gp/product/B000TEST02?ref_=E_RefundConfirmation_Asin_Title)
Quantity: 1
Order # 112-0000000-0000004`,
};
