import 'package:flutter/widgets.dart';

import '../../../models/onboarding.dart';
import 'profile_form_values.dart';

/// Holds the live profile form state + per-field errors, and exposes it to the
/// panels via an [InheritedNotifier] — the Flutter analogue of RN's
/// react-hook-form `useFormContext`.
class ProfileFormController extends ChangeNotifier {
  ProfileFormController(this._values) : _initial = _values.clone();

  ProfileFormValues _values;
  ProfileFormValues _initial;
  Map<ProfileField, String> _errors = const {};

  ProfileFormValues get values => _values;
  Map<ProfileField, String> get errors => _errors;

  /// Dirty = current values differ from the last-saved snapshot. Drives the
  /// floating Save/Cancel bar (RN `formState.isDirty`).
  bool get isDirty => !_values.equalsTo(_initial);

  String? errorFor(ProfileField f) => _errors[f];

  /// Apply a mutation and notify listeners. Clears a field's error when its
  /// owning field is one of the numeric metrics (re-validation happens on save).
  void update(void Function(ProfileFormValues v) mutate) {
    mutate(_values);
    notifyListeners();
  }

  void setActivity(ActivityLevel a) => update((v) => v.activityLevel = a);

  void setGoal(Goal g) => update((v) {
        v.goal = g;
        // Mirror RN: switching to cutting/bulking seeds a default pace.
        if (g != Goal.maintaining && v.aggression == null) {
          v.aggression = 0.5;
        }
      });

  void setErrors(Map<ProfileField, String> errors) {
    _errors = errors;
    notifyListeners();
  }

  void clearError(ProfileField f) {
    if (_errors.containsKey(f)) {
      _errors = {..._errors}..remove(f);
      notifyListeners();
    }
  }

  /// Resets to the last-saved snapshot (RN `form.reset(defaultValues)`).
  void reset() {
    _values = _initial.clone();
    _errors = const {};
    notifyListeners();
  }

  /// Marks the current values as the new clean baseline (RN `form.reset(values)`
  /// after a successful save).
  void markSaved() {
    _initial = _values.clone();
    notifyListeners();
  }

  static ProfileFormController of(BuildContext context) {
    final scope = context
        .dependOnInheritedWidgetOfExactType<ProfileFormScope>();
    assert(scope != null, 'ProfileFormController.of() outside a ProfileFormScope');
    return scope!.controller;
  }
}

/// InheritedNotifier exposing a [ProfileFormController] to descendants.
class ProfileFormScope extends InheritedNotifier<ProfileFormController> {
  const ProfileFormScope({
    super.key,
    required this.controller,
    required super.child,
  }) : super(notifier: controller);

  final ProfileFormController controller;
}
