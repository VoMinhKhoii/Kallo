import '../../features/settings/settings_test_support.dart' show kFullProfile;

/// Entirely synthetic fixtures; dates follow the app's local "today".
class PoseFixtures {
  PoseFixtures() : today = DateTime.now();

  final DateTime today;
  String date(int daysAgo) => today
      .subtract(Duration(days: daysAgo))
      .toIso8601String()
      .substring(0, 10);

  Map<String, dynamic> get profile => {
    ...kFullProfile,
    'preferredLocale': 'en',
    'countryOfOrigin': 'United Kingdom',
    'countryOfResidence': 'United Kingdom',
    'onboardingStep': 3,
  };

  static const mealNames = [
    '2 scrambled eggs on sourdough toast with half an avocado',
    'chicken burrito bowl, brown rice, black beans, no cheese',
    '250 g Greek yogurt with honey and walnuts',
    'grilled salmon, roasted potatoes and green beans',
  ];

  List<Map<String, dynamic>> get meals => [
    for (var i = 0; i < mealNames.length; i++)
      {
        'id': 'synthetic-meal-$i',
        'rawInput': mealNames[i],
        'loggedAt': '${date(0)}T${['08', '12', '15', '18'][i]}:30:00',
        'nutrition': macros(i),
        'mealItemGroups': [
          {
            'name': mealNames[i],
            'order': 0,
            'nutrition': macros(i),
            'ingredients': [
              {
                'id': 'synthetic-ingredient-$i',
                'ingredientName': mealNames[i],
                'estimatedGrams': 280.0 + i * 30,
                'userFacingUnit': 'g',
                'nutrition': macros(i),
              },
            ],
          },
        ],
      },
  ];

  Map<String, dynamic> macros(int i) => {
    'caloriesKcal': [460, 610, 340, 620][i],
    'proteinG': [22, 42, 28, 39][i],
    'carbohydrateG': [48, 70, 30, 62][i],
    'fatG': [20, 18, 12, 24][i],
  };

  Map<String, dynamic> get day => {
    'persistedMeals': meals,
    'pendingConfirmations': <dynamic>[],
    'markedComplete': true,
  };

  Map<String, dynamic> get weights => {
    'range': '30d',
    'weights': [for (var i = 0; i < 20; i++) 69.6 - i * .05],
    'weightDates': [for (var i = 0; i < 20; i++) date(29 - (i * 29 ~/ 19))],
    'currentWeight': 68.65,
    'todayWeight': 68.65,
    'weightPlaceholder': 68.65,
    'daysLogged': 20,
    'periodStartWeight': 69.6,
    'expectedEndWeight': 68.1,
    'goalDirection': 'down',
    'periodElapsedDays': 29,
    'projectedEndWeight': 68.4,
    'canProject': true,
  };

  Map<String, dynamic> get heatmap => {
    'cells': [
      for (var r = 0; r < 7; r++)
        [
          for (var c = 0; c < 13; c++)
            {
              'date': date((12 - c) * 7 + (6 - r)),
              'ratio': .65 + ((r + c) % 4) * .1,
              'consumedRatio': .65 + ((r + c) % 4) * .1,
              'calories': 1900.0,
              'status': (r + c) % 6 == 0 ? 'partial' : 'logged',
            },
        ],
    ],
    'monthHeaders': [
      for (var c = 0; c < 13; c += 4)
        {
          'month':
              [
                'Jan',
                'Feb',
                'Mar',
                'Apr',
                'May',
                'Jun',
                'Jul',
                'Aug',
                'Sep',
                'Oct',
                'Nov',
                'Dec',
              ][today.subtract(Duration(days: (12 - c) * 7)).month - 1],
          'monthIndex': today.subtract(Duration(days: (12 - c) * 7)).month,
          'startColumn': c,
          'span': c == 12 ? 1 : 4,
        },
    ],
  };

  Map<String, dynamic> get dashboard => {
    'profile': profile,
    'day': day,
    'weightSummary': weights,
    'heatmap': heatmap,
  };

  Map<String, dynamic> get circleProfile => {
    'userId': 'pose-viewer',
    'handle': 'alex_sample',
    'displayName': 'Alex Morgan',
  };

  List<Map<String, dynamic>> get posts => [
    for (var i = 0; i < 3; i++)
      {
        'friend': {
          'userId': 'synthetic-friend-${i % 2}',
          'handle': i.isEven ? 'jamie_sample' : 'sam_sample',
          'displayName': i.isEven ? 'Jamie Rivera' : 'Sam Taylor',
        },
        'isSelf': false,
        'meal': {
          'mealId': 'friend-meal-$i',
          'shareId': 'friend-share-$i',
          'rawInput': mealNames[i],
          'sharedAt': '${date(0)}T12:30:00Z',
          ...macros(i),
        },
        'reactions': {'mine': false, 'count': i + 1},
        'replies': <dynamic>[],
        'repliesTotal': 0,
      },
  ];
}
