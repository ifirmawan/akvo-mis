import { validateDependency, onFilterDependency } from '../index';

describe('validateDependency', () => {
  test('should validate option-based dependency with array value', () => {
    const dep = { id: 1, options: ['raw_water_main'] };
    const value = ['raw_water_main', 'reservoir'];
    expect(validateDependency(dep, value)).toBe(true);
  });

  test('should validate option-based dependency with string value', () => {
    const dep = { id: 1, options: ['surface_water_project'] };
    const value = 'surface_water_project';
    expect(validateDependency(dep, value)).toBe(true);
  });

  test('should return false when option does not match', () => {
    const dep = { id: 1, options: ['raw_water_main'] };
    const value = ['dam', 'reservoir'];
    expect(validateDependency(dep, value)).toBe(false);
  });

  test('should validate min dependency', () => {
    const dep = { id: 1, min: 5 };
    expect(validateDependency(dep, 10)).toBe(true);
    expect(validateDependency(dep, 5)).toBe(true);
    expect(validateDependency(dep, 3)).toBe(false);
  });

  test('should validate max dependency', () => {
    const dep = { id: 1, max: 10 };
    expect(validateDependency(dep, 5)).toBe(true);
    expect(validateDependency(dep, 10)).toBe(true);
    expect(validateDependency(dep, 15)).toBe(false);
  });

  test('should validate equal dependency', () => {
    const dep = { id: 1, equal: 'test' };
    expect(validateDependency(dep, 'test')).toBe(true);
    expect(validateDependency(dep, 'other')).toBe(false);
  });

  test('should validate notEqual dependency', () => {
    const dep = { id: 1, notEqual: 'test' };
    expect(validateDependency(dep, 'other')).toBe(true);
    expect(validateDependency(dep, 'test')).toBe(false);
    expect(validateDependency(dep, null)).toBe(false); // null is not valid for notEqual
  });
});

describe('onFilterDependency - OR rule', () => {
  const currentGroup = {
    question: [{ id: 1749622726348 }, { id: 1749622726349 }, { id: 1749622726350 }],
  };

  const allQuestions = [
    { id: 1749622726348 },
    { id: 1749622726349 },
    {
      id: 1749622726350,
      dependency_rule: 'OR',
      dependency: [
        { id: 1749622726348, options: ['raw_water_main'] },
        { id: 1749622726349, options: ['raw_water_main'] },
      ],
    },
  ];

  test('should return question when first dependency is satisfied (OR)', () => {
    const question = allQuestions[2];
    const values = {
      1749622726348: ['raw_water_main'],
      1749622726349: [],
    };
    const result = onFilterDependency(currentGroup, values, question, 0, allQuestions);
    expect(result).toBe(question);
  });

  test('should return question when second dependency is satisfied (OR)', () => {
    const question = allQuestions[2];
    const values = {
      1749622726348: [],
      1749622726349: ['raw_water_main'],
    };
    const result = onFilterDependency(currentGroup, values, question, 0, allQuestions);
    expect(result).toBe(question);
  });

  test('should return question when both dependencies are satisfied (OR)', () => {
    const question = allQuestions[2];
    const values = {
      1749622726348: ['raw_water_main'],
      1749622726349: ['raw_water_main'],
    };
    const result = onFilterDependency(currentGroup, values, question, 0, allQuestions);
    expect(result).toBe(question);
  });

  test('should return false when no dependencies are satisfied (OR)', () => {
    const question = allQuestions[2];
    const values = {
      1749622726348: [],
      1749622726349: [],
    };
    const result = onFilterDependency(currentGroup, values, question, 0, allQuestions);
    expect(result).toBe(false);
  });

  test('should return false when dependencies have different options (OR)', () => {
    const question = allQuestions[2];
    const values = {
      1749622726348: ['dam'],
      1749622726349: ['reservoir'],
    };
    const result = onFilterDependency(currentGroup, values, question, 0, allQuestions);
    expect(result).toBe(false);
  });
});

describe('onFilterDependency - AND rule', () => {
  const currentGroup = {
    question: [{ id: 1723459200018 }, { id: 1723459210020 }, { id: 1723459220030 }],
  };

  const allQuestions = [
    { id: 1723459200018 },
    { id: 1723459210020 },
    {
      id: 1723459220030,
      dependency_rule: 'AND',
      dependency: [
        { id: 1723459200018, options: ['raw_water_pipeline'] },
        { id: 1723459210020, options: ['pvc', 'polyethelene'] },
      ],
    },
  ];

  test('should return question when all dependencies are satisfied (AND)', () => {
    const question = allQuestions[2];
    const values = {
      1723459200018: ['raw_water_pipeline'],
      1723459210020: ['pvc'],
    };
    const result = onFilterDependency(currentGroup, values, question, 0, allQuestions);
    expect(result).toBe(question);
  });

  test('should return question with multiple matching options (AND)', () => {
    const question = allQuestions[2];
    const values = {
      1723459200018: ['raw_water_pipeline', 'air_valve'],
      1723459210020: ['polyethelene'],
    };
    const result = onFilterDependency(currentGroup, values, question, 0, allQuestions);
    expect(result).toBe(question);
  });

  test('should return false when first dependency is not satisfied (AND)', () => {
    const question = allQuestions[2];
    const values = {
      1723459200018: [],
      1723459210020: ['pvc'],
    };
    const result = onFilterDependency(currentGroup, values, question, 0, allQuestions);
    expect(result).toBe(false);
  });

  test('should return false when second dependency is not satisfied (AND)', () => {
    const question = allQuestions[2];
    const values = {
      1723459200018: ['raw_water_pipeline'],
      1723459210020: [],
    };
    const result = onFilterDependency(currentGroup, values, question, 0, allQuestions);
    expect(result).toBe(false);
  });

  test('should return false when no dependencies are satisfied (AND)', () => {
    const question = allQuestions[2];
    const values = {
      1723459200018: [],
      1723459210020: [],
    };
    const result = onFilterDependency(currentGroup, values, question, 0, allQuestions);
    expect(result).toBe(false);
  });
});

describe('onFilterDependency - default behavior', () => {
  const currentGroup = {
    question: [{ id: 1 }, { id: 2 }, { id: 3 }],
  };

  const allQuestions = [
    { id: 1 },
    { id: 2 },
    {
      id: 3,
      dependency: [
        { id: 1, options: ['a'] },
        { id: 2, options: ['b'] },
      ],
    }, // No dependency_rule specified
  ];

  test('should default to AND when dependency_rule is not specified', () => {
    const question = allQuestions[2];
    const values = {
      1: ['a'],
      2: ['b'],
    };
    const result = onFilterDependency(currentGroup, values, question, 0, allQuestions);
    expect(result).toBe(question);
  });

  test('should default to AND and return false when one dependency fails', () => {
    const question = allQuestions[2];
    const values = {
      1: ['a'],
      2: [], // Second dependency not satisfied
    };
    const result = onFilterDependency(currentGroup, values, question, 0, allQuestions);
    expect(result).toBe(false);
  });

  test('should return question when no dependencies exist', () => {
    const question = { id: 4 };
    const values = {};
    const result = onFilterDependency(currentGroup, values, question, 0, allQuestions);
    expect(result).toBe(question);
  });

  test('should return question when dependency is undefined', () => {
    const question = { id: 5 };
    const values = {};
    const result = onFilterDependency(currentGroup, values, question, 0, allQuestions);
    expect(result).toBe(question);
  });
});

describe('onFilterDependency - case insensitive rule', () => {
  const currentGroup = {
    question: [{ id: 1 }, { id: 2 }, { id: 3 }],
  };

  test('should handle lowercase "or" as OR', () => {
    const allQuestions = [
      { id: 1 },
      { id: 2 },
      {
        id: 3,
        dependency_rule: 'or',
        dependency: [
          { id: 1, options: ['a'] },
          { id: 2, options: ['b'] },
        ],
      },
    ];
    const question = allQuestions[2];
    const values = {
      1: ['a'],
      2: [],
    };
    const result = onFilterDependency(currentGroup, values, question, 0, allQuestions);
    expect(result).toBe(question);
  });

  test('should handle lowercase "and" as AND', () => {
    const allQuestions = [
      { id: 1 },
      { id: 2 },
      {
        id: 3,
        dependency_rule: 'and',
        dependency: [
          { id: 1, options: ['a'] },
          { id: 2, options: ['b'] },
        ],
      },
    ];
    const question = allQuestions[2];
    const values = {
      1: ['a'],
      2: ['b'],
    };
    const result = onFilterDependency(currentGroup, values, question, 0, allQuestions);
    expect(result).toBe(question);
  });
});
