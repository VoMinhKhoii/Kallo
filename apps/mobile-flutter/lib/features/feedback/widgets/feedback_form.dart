import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../shared/widgets/form/quiet_action_button.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import 'feedback_fields.dart';

const int kMaxFeedbackMessageLength = 4000;

/// The feedback form body.
///
/// No title and no description here: the title lives in the [PageHeader] bar
/// and the description only restated it. The one label that survives is
/// "What's this about?" — a question the type control answers, not a repeat of
/// anything. The message field needs none: its placeholder already asks.
class FeedbackForm extends StatelessWidget {
  const FeedbackForm({
    super.key,
    required this.type,
    required this.onTypeChanged,
    required this.message,
    required this.image,
    required this.busy,
    required this.error,
    required this.onPickImage,
    required this.onRemoveImage,
    required this.onSubmit,
  });

  final String type;
  final ValueChanged<String> onTypeChanged;
  final TextEditingController message;
  final XFile? image;
  final bool busy;
  final String? error;
  final VoidCallback onPickImage;
  final VoidCallback onRemoveImage;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final canSubmit = message.text.trim().isNotEmpty && !busy;
    return ListView(
      // The same shape as settings' `SettingsSpacing.page`
      // (`features/settings/logic/settings_spacing.dart`) — inlined rather
      // than imported, because feedback is its own feature and one page's
      // padding is not worth a cross-feature dependency. The bottom clears
      // the home indicator, which the hand-rolled sp6 used to ignore.
      padding: EdgeInsets.fromLTRB(
        KalloSpacing.sp3,
        KalloSpacing.sp2,
        KalloSpacing.sp3,
        KalloSpacing.sp8 + MediaQuery.viewPaddingOf(context).bottom,
      ),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      children: [
        Text(tr('settings.feedback.typeLabel'), style: dashMeta()),
        const SizedBox(height: KalloSpacing.sp2),
        Row(
          children: [
            for (var i = 0; i < kFeedbackTypes.length; i++) ...[
              if (i > 0) const SizedBox(width: KalloSpacing.sp2),
              Expanded(
                child: FeedbackTypeChip(
                  type: kFeedbackTypes[i],
                  selected: type == kFeedbackTypes[i].value,
                  onTap: () => onTypeChanged(kFeedbackTypes[i].value),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: KalloSpacing.sp4),

        _MessageField(controller: message, type: type, busy: busy),
        const SizedBox(height: 4),
        Align(
          alignment: Alignment.centerRight,
          child: Text(
            '${message.text.characters.length} / $kMaxFeedbackMessageLength',
            style: dashMeta(tabular: true),
          ),
        ),
        const SizedBox(height: KalloSpacing.sp2),

        FeedbackScreenshotField(
          file: image,
          onAdd: busy ? null : onPickImage,
          onRemove: busy ? null : onRemoveImage,
        ),

        if (error != null) ...[
          const SizedBox(height: KalloSpacing.sp3),
          Text(error!, style: dashMeta(color: KalloColors.danger)),
        ],

        const SizedBox(height: KalloSpacing.sp5),
        // The quiet confirm the logging card's Save uses, parked at the end of
        // its row — not a full-width umber CTA. The umber is spent on one
        // primary action per surface, and a feedback form's submit isn't it.
        // (The success screen's Done IS its surface's one action, so that one
        // is a full KalloButton — two tiers by design, not an inconsistency.)
        Align(
          alignment: Alignment.centerRight,
          child: QuietActionButton(
            label: tr('settings.feedback.submit'),
            busy: busy,
            enabled: canSubmit,
            onTap: canSubmit ? onSubmit : null,
          ),
        ),
      ],
    );
  }
}

/// The message box.
///
/// Deliberately NOT [KalloTextField]: that primitive is the app's full-round
/// 52pt single-line input pill, and this field is six lines tall. It borrows
/// the CARD idiom instead — card surface, `KalloRadii.xxxl` (22, the app's
/// card radius, not the 12 it used to draw), one hairline border, 16/12
/// padding, body text — so a multi-line field reads as the card it is.
class _MessageField extends StatelessWidget {
  const _MessageField({
    required this.controller,
    required this.type,
    required this.busy,
  });

  final TextEditingController controller;
  final String type;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: BorderRadius.circular(KalloRadii.xxxl),
        border: Border.all(color: KalloColors.borderSoft),
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: KalloSpacing.sp4,
        vertical: KalloSpacing.sp3,
      ),
      child: TextField(
        controller: controller,
        enabled: !busy,
        maxLines: 6,
        maxLength: kMaxFeedbackMessageLength,
        cursorColor: kInk,
        style: dashBody(),
        decoration: InputDecoration(
          isDense: true,
          counterText: '',
          // All four, plus filled:false. The app theme sets `filled: true`
          // and an OutlineInputBorder on `enabledBorder`, so clearing only
          // `border` left the field painting its own box INSIDE this
          // container — the nested-card look.
          filled: false,
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          disabledBorder: InputBorder.none,
          contentPadding: EdgeInsets.zero,
          hintText: tr('settings.feedback.placeholder.$type'),
          hintStyle: dashBody(color: kInkMuted),
        ),
      ),
    );
  }
}
