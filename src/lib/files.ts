/** آدرس عمومی تصویر ذخیره‌شده */
export const fileUrl = (id: string | null | undefined) => (id ? `/api/files/${id}` : null);
