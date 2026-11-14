import { relations } from "drizzle-orm";
import { users } from "./auth";
import { bookingEvents, bookings } from "./bookings";
import { favorites } from "./favorites";
import { files } from "./files";
import { notifications } from "./notifications";
import { portfolioItems } from "./portfolio";
import { profiles } from "./profiles";
import { reviews } from "./reviews";
import { salonMembers, salons } from "./salons";
import { workingHours, workingTimeOff } from "./schedules";
import { services, stylistServices } from "./services";
import { stylists } from "./stylists";

// روابط جداول Better Auth (sessions/accounts) در auth.ts تولید شده‌اند.
export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
  avatar: one(files, { fields: [profiles.avatarFileId], references: [files.id] }),
}));

export const salonsRelations = relations(salons, ({ one, many }) => ({
  owner: one(users, { fields: [salons.ownerId], references: [users.id] }),
  cover: one(files, { fields: [salons.coverFileId], references: [files.id] }),
  members: many(salonMembers),
  services: many(services),
  workingHours: many(workingHours),
  timeOff: many(workingTimeOff),
  bookings: many(bookings),
  reviews: many(reviews),
  portfolio: many(portfolioItems),
}));

export const salonMembersRelations = relations(salonMembers, ({ one }) => ({
  salon: one(salons, { fields: [salonMembers.salonId], references: [salons.id] }),
  user: one(users, { fields: [salonMembers.userId], references: [users.id] }),
}));

export const stylistsRelations = relations(stylists, ({ one, many }) => ({
  user: one(users, { fields: [stylists.userId], references: [users.id] }),
  services: many(stylistServices),
  ownServices: many(services),
  workingHours: many(workingHours),
  timeOff: many(workingTimeOff),
  bookings: many(bookings),
  reviews: many(reviews),
  portfolio: many(portfolioItems),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  salon: one(salons, { fields: [services.salonId], references: [salons.id] }),
  stylist: one(stylists, { fields: [services.stylistId], references: [stylists.id] }),
  stylists: many(stylistServices),
}));

export const stylistServicesRelations = relations(stylistServices, ({ one }) => ({
  stylist: one(stylists, { fields: [stylistServices.stylistId], references: [stylists.id] }),
  service: one(services, { fields: [stylistServices.serviceId], references: [services.id] }),
}));

export const workingHoursRelations = relations(workingHours, ({ one }) => ({
  salon: one(salons, { fields: [workingHours.salonId], references: [salons.id] }),
  stylist: one(stylists, { fields: [workingHours.stylistId], references: [stylists.id] }),
}));

export const workingTimeOffRelations = relations(workingTimeOff, ({ one }) => ({
  salon: one(salons, { fields: [workingTimeOff.salonId], references: [salons.id] }),
  stylist: one(stylists, { fields: [workingTimeOff.stylistId], references: [stylists.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  customer: one(users, { fields: [bookings.customerId], references: [users.id] }),
  stylist: one(stylists, { fields: [bookings.stylistId], references: [stylists.id] }),
  salon: one(salons, { fields: [bookings.salonId], references: [salons.id] }),
  service: one(services, { fields: [bookings.serviceId], references: [services.id] }),
  events: many(bookingEvents),
  review: one(reviews, { fields: [bookings.id], references: [reviews.bookingId] }),
}));

export const bookingEventsRelations = relations(bookingEvents, ({ one }) => ({
  booking: one(bookings, { fields: [bookingEvents.bookingId], references: [bookings.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  booking: one(bookings, { fields: [reviews.bookingId], references: [bookings.id] }),
  customer: one(users, { fields: [reviews.customerId], references: [users.id] }),
  stylist: one(stylists, { fields: [reviews.stylistId], references: [stylists.id] }),
  salon: one(salons, { fields: [reviews.salonId], references: [salons.id] }),
}));

export const portfolioItemsRelations = relations(portfolioItems, ({ one }) => ({
  stylist: one(stylists, { fields: [portfolioItems.stylistId], references: [stylists.id] }),
  salon: one(salons, { fields: [portfolioItems.salonId], references: [salons.id] }),
  service: one(services, { fields: [portfolioItems.serviceId], references: [services.id] }),
  file: one(files, { fields: [portfolioItems.fileId], references: [files.id] }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  customer: one(users, { fields: [favorites.customerId], references: [users.id] }),
  salon: one(salons, { fields: [favorites.salonId], references: [salons.id] }),
  stylist: one(stylists, { fields: [favorites.stylistId], references: [stylists.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const filesRelations = relations(files, ({ one }) => ({
  owner: one(users, { fields: [files.ownerId], references: [users.id] }),
}));
