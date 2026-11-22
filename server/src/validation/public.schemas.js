import { z } from 'zod';

const personName = z.string().trim().min(1, 'Enter a name').max(60, 'Keep names under 60 characters');
const title = z.string().trim().min(1, 'Give this split a name').max(80, 'Keep the title under 80 characters');

export const createSplitSchema = z.object({
  title,
  people: z.array(personName).min(1, 'Add at least one person').max(60, 'That is a lot of people'),
});

export const updateSplitSchema = z
  .object({
    title: title.optional(),
    addPeople: z.array(personName).min(1).max(60).optional(),
  })
  .refine((value) => value.title || value.addPeople, {
    message: 'Nothing to update',
  });

export const addExpenseSchema = z.object({
  description: z.string().trim().min(1, 'Add a short description').max(120),
  amount: z.coerce
    .number()
    .positive('Enter an amount greater than zero')
    .max(100_000_000, 'That amount is too large'),
  paidBy: z.string().trim().min(1, 'Choose who paid'),
  participants: z.array(z.string().trim().min(1)).min(1, 'Pick at least one person to share this'),
  date: z.string().optional(),
});
