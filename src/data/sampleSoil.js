// A real soil report from a friend of Mike's, shared with permission.
// Names, address, lab name/branding, sample ID and date are deliberately left out. Values in ppm except pH.
// rating: low | ok | high (as the lab rated it). range: the lab's optimal range.

export const SAMPLE_SOIL = {
  groups: [
    {
      name: 'The big three',
      rows: [
        { id: 'ph', name: 'pH', value: 5.47, show: '5.5', range: [6, 7.2], scale: [4, 8], rating: 'low',
          note: 'Sour. This is the whole problem. The grass can’t get to the food that’s already in there.' },
        { id: 'p', name: 'Phosphorus', value: 17.03, show: '17', range: [5, 11], rating: 'high',
          note: 'Loaded. He doesn’t need to buy phosphorus for years.' },
        { id: 'k', name: 'Potassium', value: 94.27, show: '94', range: [38, 72], rating: 'high',
          note: 'Also loaded. Skip the fancy high-potassium fall bags.' },
      ],
    },
    {
      name: 'The supporting cast',
      rows: [
        { id: 'ca', name: 'Calcium', value: 261.54, show: '262', range: [93, 314], rating: 'ok', note: 'Fine.' },
        { id: 'mg', name: 'Magnesium', value: 58.56, show: '59', range: [28, 67], rating: 'ok',
          note: 'Fine. That’s why he gets calcitic lime, not dolomitic.' },
        { id: 's', name: 'Sulfur', value: 14.75, show: '15', range: [7, 16], rating: 'ok', note: 'Fine.' },
        { id: 'na', name: 'Sodium', value: 20.41, show: '20', range: [0.5, 30], rating: 'ok', note: 'Fine. The road salt stayed on the road.' },
      ],
    },
    {
      name: 'The tiny stuff',
      rows: [
        { id: 'fe', name: 'Iron', value: 63.6, show: '64', range: [4, 11], rating: 'high',
          note: 'Way high. Classic sour-soil side effect. Fix the pH and this calms down.' },
        { id: 'mn', name: 'Manganese', value: 27.21, show: '27', range: [4, 12], rating: 'high',
          note: 'Same story as iron. Sour soil sets it loose.' },
        { id: 'zn', name: 'Zinc', value: 0.27, show: '0.27', range: [0.1, 0.25], rating: 'high',
          note: 'High by a hair. Ignore it.' },
        { id: 'cu', name: 'Copper', value: 0.22, show: '0.22', range: [0.07, 0.28], rating: 'ok', note: 'Fine.' },
        { id: 'b', name: 'Boron', value: 0.14, show: '0.14', range: [0.22, 0.66], rating: 'low',
          note: 'A little low. Don’t chase it. Boron is one where too much hurts.' },
      ],
    },
    {
      name: 'Ignore this one',
      rows: [
        { id: 'n', name: 'Nitrogen', value: 33.65, show: '34', range: [7, 18], rating: 'high',
          note: 'It changes week to week. He still feeds on the holidays like everybody else.' },
      ],
    },
  ],
  // What the translator should load for "Try my buddy's report"
  translator: { ph: '5.5', p: 'high', k: 'high', mg: 'ok', om: 'ok' },
};
