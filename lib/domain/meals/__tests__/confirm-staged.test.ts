import { beforeEach, describe, expect, it, vi } from 'vitest';

const confirmAndSaveMealAction = vi.fn();
const deleteWhere = vi.fn();
const selectLimit = vi.fn();
const db = {
  delete: vi.fn(() => ({ where: deleteWhere })),
  select: vi.fn(() => ({
    from: () => ({ where: () => ({ limit: selectLimit }) }),
  })),
};

vi.mock('@/lib/actions/meals/confirm-and-save', () => ({
  confirmAndSaveMealAction,
}));
vi.mock('@/lib/infra/db/client', () => ({ db }));

const { Errors } = await import('@/lib/core/errors/catalog');
const { confirmStagedMeal } = await import('@/lib/domain/meals/confirm-staged');

const run = () => confirmStagedMeal('user-1', 'analysis-1', 'meal-1');

beforeEach(() => {
  vi.clearAllMocks();
  deleteWhere.mockResolvedValue(undefined);
  selectLimit.mockResolvedValue([]);
});

describe('confirmStagedMeal', () => {
  it('confirms the staged meal with the client id', async () => {
    confirmAndSaveMealAction.mockResolvedValue({ mealId: 'meal-1' });

    await expect(run()).resolves.toEqual({ mealId: 'meal-1' });
    expect(confirmAndSaveMealAction).toHaveBeenCalledWith({
      analysisId: 'analysis-1',
      mealId: 'meal-1',
    });
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("answers MEAL_ALREADY_SAVED for the caller's own meal, and drops the card", async () => {
    confirmAndSaveMealAction.mockRejectedValue(Errors.conflict('taken'));
    selectLimit.mockResolvedValue([{ id: 'meal-1' }]);

    await expect(run()).rejects.toMatchObject({
      code: 'MEAL_ALREADY_SAVED',
      status: 409,
    });
    expect(db.delete).toHaveBeenCalledTimes(1);
  });

  it('keeps the plain conflict for an id the caller does not own', async () => {
    const conflict = Errors.conflict('taken');
    confirmAndSaveMealAction.mockRejectedValue(conflict);

    await expect(run()).rejects.toBe(conflict);
    expect(db.delete).toHaveBeenCalledTimes(1);
  });

  it('never claims a save it cannot check, nor masks the conflict', async () => {
    const conflict = Errors.conflict('taken');
    confirmAndSaveMealAction.mockRejectedValue(conflict);
    deleteWhere.mockRejectedValue(new Error('db down'));
    selectLimit.mockRejectedValue(new Error('db down'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run()).rejects.toBe(conflict);
    log.mockRestore();
  });

  it('leaves the card alone on any other failure', async () => {
    confirmAndSaveMealAction.mockRejectedValue(new Error('boom'));

    await expect(run()).rejects.toThrow('boom');
    expect(db.delete).not.toHaveBeenCalled();
  });
});
