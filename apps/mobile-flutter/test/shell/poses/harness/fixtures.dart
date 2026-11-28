import '../../../features/settings/settings_test_support.dart'
    show kFullProfile;

/// Entirely synthetic fixtures; dates follow the app's local "today".
class PoseFixtures {
  PoseFixtures({this.locale = 'en'}) : today = DateTime.now();

  /// The language the person writes in and has set on their account: their
  /// meals and their friends' replies come in it. English, or `vi`.
  final String locale;
  final DateTime today;
  String date(int daysAgo) => today
      .subtract(Duration(days: daysAgo))
      .toIso8601String()
      .substring(0, 10);

  Map<String, dynamic> get profile => {
    ...kFullProfile,
    'preferredLocale': locale,
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

  /// The same four meals as a Vietnamese speaker types them.
  static const mealNamesVi = [
    '2 trứng bác ăn với bánh mì sourdough nướng và nửa quả bơ',
    'cơm gà kiểu burrito, gạo lứt, đậu đen, không phô mai',
    '250 g sữa chua Hy Lạp với mật ong và óc chó',
    'cá hồi nướng, khoai tây nướng và đậu que',
  ];

  List<String> get _names => locale == 'vi' ? mealNamesVi : mealNames;

  List<Map<String, dynamic>> get meals => [
    for (var i = 0; i < mealNames.length; i++)
      {
        'id': 'synthetic-meal-$i',
        'rawInput': _names[i],
        'loggedAt': '${date(0)}T${['08', '12', '15', '18'][i]}:30:00',
        'nutrition': macros(i),
        'mealItemGroups': [
          {
            'name': _names[i],
            'order': 0,
            'nutrition': macros(i),
            'ingredients': [
              {
                'id': 'synthetic-ingredient-$i',
                'ingredientName': _names[i],
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

  static const pastMealNames = [
    'overnight oats with berries and almond butter',
    'turkey and avocado wrap',
    'miso soup with tofu and rice',
    'peanut butter banana toast',
    'lentil soup with crusty bread',
    'shakshuka with pita',
  ];

  static const pastMealNamesVi = [
    'yến mạch ngâm qua đêm với dâu và bơ hạnh nhân',
    'bánh tortilla cuộn gà tây và quả bơ',
    'súp miso với đậu phụ và cơm',
    'bánh mì nướng phết bơ đậu phộng và chuối',
    'súp đậu lăng ăn với bánh mì giòn',
    'shakshuka ăn với bánh mì pita',
  ];

  List<String> get _pastNames =>
      locale == 'vi' ? pastMealNamesVi : pastMealNames;

  /// The day [when] names, as `/logging/day` serves it: today is [day];
  /// every fourth day back is empty; the rest hold three or four meals.
  Map<String, dynamic> dayFor(String? when) {
    final ago =
        when == null
            ? 0
            : DateTime.parse(date(0)).difference(DateTime.parse(when)).inDays;
    if (ago <= 0) return day;
    if (ago % 4 == 3) {
      return {
        'persistedMeals': <dynamic>[],
        'pendingConfirmations': <dynamic>[],
      };
    }
    // Yesterday is whole, so the under-logged note stays down.
    final count = ago == 1 ? 4 : 3;
    return {
      'persistedMeals': [
        for (var i = 0; i < count; i++)
          {
            'id': 'synthetic-past-$ago-$i',
            'rawInput': _pastNames[(ago + i) % _pastNames.length],
            'loggedAt': '${when}T${['08', '12', '16', '19'][i]}:00:00',
            'nutrition': macros((ago + i) % 4),
            'mealItemGroups': <dynamic>[],
          },
      ],
      'pendingConfirmations': <dynamic>[],
    };
  }

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
          'rawInput': _names[i],
          'sharedAt': '${date(0)}T12:30:00Z',
          ...macros(i),
        },
        'reactions': {'mine': false, 'count': i + 1},
        'replies': <dynamic>[],
        'repliesTotal': 0,
      },
  ];

  Map<String, dynamic> get thread => {
    ...posts.first,
    'meal': {
      ...posts.first['meal'] as Map<String, dynamic>,
      'shareId': 'thread-detail',
    },
    'replies': [
      for (var i = 0; i < 2; i++)
        {
          'id': 'pose-reply-$i',
          'isSelf': false,
          'author': {
            'userId': 'pose-replier-$i',
            'handle': 'sam_sample',
            'displayName': 'Sam Taylor',
          },
          'body':
              locale == 'vi'
                  ? (i == 0
                      ? 'Bữa sáng thế này là ổn rồi đấy.'
                      : 'Mai mình sẽ thử món này.')
                  : (i == 0
                      ? 'That looks like a good start to the day.'
                      : 'I will try this tomorrow.'),
          'createdAt': '${date(0)}T13:30:00Z',
        },
    ],
    'repliesTotal': 2,
  };
}
