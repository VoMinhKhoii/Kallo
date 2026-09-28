import { beforeEach, describe, expect, it, vi } from 'vitest';

const confirmStagedMeal = vi.fn();
const requireAuthAndProfile = vi.fn();

vi.mock('@/lib/domain/meals/confirm-staged', () => ({ confirmStagedMeal }));
vi.mock('@/lib/infra/auth/session', () => ({ requireAuthAndProfile }));

const { Errors } = await import('@/lib/core/errors/catalog');
const { confirmScanMealAction } = await import(
  '@/lib/actions/meals/confirm-scan-meal'
);

const input = {
  analysisId: '2b8e2f6a-4f9f-4d38-9f6e-1a2b3c4d5e6f',
  mealId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
};

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthAndProfile.mockResolvedValue({ user: { id: 'user-1' } });
});

describe('confirmScanMealAction', () => {
  it("confirms the staged meal under the dialog's own id", async () => {
    confirmStagedMeal.mockResolvedValue({ mealId: input.mealId });

    await expect(confirmScanMealAction(input)).resolves.toEqual({
      success: true,
    });
    expect(confirmStagedMeal).toHaveBeenCalledWith(
      'user-1',
      input.analysisId,
      input.mealId
    );
  });

  it('answers a retry of a save that landed as saved', async () => {
    confirmStagedMeal.mockRejectedValue(Errors.mealAlreadySaved());

    await expect(confirmScanMealAction(input)).resolves.toEqual({
      success: true,
    });
  });

  it('keeps any other failure a failure — a foreign id included', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    confirmStagedMeal.mockRejectedValue(Errors.conflict('taken'));

    await expect(confirmScanMealAction(input)).resolves.toEqual({
      success: false,
      code: 'server_error',
    });
    log.mockRestore();
  });

  it('refuses ids that are not UUIDs before touching anything', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      confirmScanMealAction({ ...input, mealId: 'meal-1' })
    ).resolves.toEqual({ success: false, code: 'server_error' });
    expect(confirmStagedMeal).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
