import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type * as s from "./schema";

export type User = InferSelectModel<typeof s.users>;
export type Profile = InferSelectModel<typeof s.profiles>;
export type NewProfile = InferInsertModel<typeof s.profiles>;
export type Salon = InferSelectModel<typeof s.salons>;
export type NewSalon = InferInsertModel<typeof s.salons>;
export type SalonMember = InferSelectModel<typeof s.salonMembers>;
export type Stylist = InferSelectModel<typeof s.stylists>;
export type Service = InferSelectModel<typeof s.services>;
export type StylistService = InferSelectModel<typeof s.stylistServices>;
export type WorkingHours = InferSelectModel<typeof s.workingHours>;
export type WorkingTimeOff = InferSelectModel<typeof s.workingTimeOff>;
export type Booking = InferSelectModel<typeof s.bookings>;
export type BookingEvent = InferSelectModel<typeof s.bookingEvents>;
export type Review = InferSelectModel<typeof s.reviews>;
export type PortfolioItem = InferSelectModel<typeof s.portfolioItems>;
export type Favorite = InferSelectModel<typeof s.favorites>;
export type Notification = InferSelectModel<typeof s.notifications>;
export type StoredFile = InferSelectModel<typeof s.files>;

export type UserRole = (typeof s.userRole.enumValues)[number];
export type SalonMemberRole = (typeof s.salonMemberRole.enumValues)[number];
export type SalonPermission = (typeof s.salonPermission.enumValues)[number];
export type MembershipStatus = (typeof s.membershipStatus.enumValues)[number];
export type BookingStatus = (typeof s.bookingStatus.enumValues)[number];
export type BookingActor = (typeof s.bookingActor.enumValues)[number];
export type FilePurpose = (typeof s.filePurpose.enumValues)[number];
