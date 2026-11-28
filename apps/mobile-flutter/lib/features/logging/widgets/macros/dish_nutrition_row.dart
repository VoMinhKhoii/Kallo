import 'package:flutter/widgets.dart';

/// Reading text keeps its two lines when the numeric tail would squeeze it.
class DishNutritionRow extends StatelessWidget {
  const DishNutritionRow({
    super.key,
    required this.name,
    required this.nutrition,
  });
  final Widget name;
  final Widget nutrition;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, bounds) {
      // The 235pt numeric tail leaves under 100pt for a dish at this width.
      final stacked =
          bounds.maxWidth < 334 ||
          MediaQuery.textScalerOf(context).scale(16) > 16;
      return stacked
          ? Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [name, const SizedBox(height: 6), nutrition],
          )
          : Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: name),
              const SizedBox(width: 12),
              nutrition,
            ],
          );
    },
  );
}
