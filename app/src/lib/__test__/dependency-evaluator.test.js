import {
  intersection,
  validateDependency,
  normalizeDeps,
  isDependencySatisfied,
} from '../dependency-evaluator';

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

describe('isDependencySatisfied - OR rule', () => {
  const deps = [
    { id: 1749622726348, options: ['raw_water_main'] },
    { id: 1749622726349, options: ['raw_water_main'] },
  ];

  test('should return true when first dependency is satisfied (OR)', () => {
    const question = { dependency_rule: 'OR', dependency: deps };
    const answers = {
      1749622726348: ['raw_water_main'],
      1749622726349: [],
    };
    expect(isDependencySatisfied(question, answers)).toBe(true);
  });

  test('should return true when second dependency is satisfied (OR)', () => {
    const question = { dependency_rule: 'OR', dependency: deps };
    const answers = {
      1749622726348: [],
      1749622726349: ['raw_water_main'],
    };
    expect(isDependencySatisfied(question, answers)).toBe(true);
  });

  test('should return true when both dependencies are satisfied (OR)', () => {
    const question = { dependency_rule: 'OR', dependency: deps };
    const answers = {
      1749622726348: ['raw_water_main'],
      1749622726349: ['raw_water_main'],
    };
    expect(isDependencySatisfied(question, answers)).toBe(true);
  });

  test('should return false when no dependencies are satisfied (OR)', () => {
    const question = { dependency_rule: 'OR', dependency: deps };
    const answers = {
      1749622726348: [],
      1749622726349: [],
    };
    expect(isDependencySatisfied(question, answers)).toBe(false);
  });

  test('should return false when dependencies have different options (OR)', () => {
    const question = { dependency_rule: 'OR', dependency: deps };
    const answers = {
      1749622726348: ['dam'],
      1749622726349: ['reservoir'],
    };
    expect(isDependencySatisfied(question, answers)).toBe(false);
  });
});

describe('isDependencySatisfied - AND rule', () => {
  const deps = [
    { id: 1723459200018, options: ['raw_water_pipeline'] },
    { id: 1723459210020, options: ['pvc', 'polyethelene'] },
  ];

  test('should return true when all dependencies are satisfied (AND)', () => {
    const question = { dependency_rule: 'AND', dependency: deps };
    const answers = {
      1723459200018: ['raw_water_pipeline'],
      1723459210020: ['pvc'],
    };
    expect(isDependencySatisfied(question, answers)).toBe(true);
  });

  test('should return true with multiple matching options (AND)', () => {
    const question = { dependency_rule: 'AND', dependency: deps };
    const answers = {
      1723459200018: ['raw_water_pipeline', 'air_valve'],
      1723459210020: ['polyethelene'],
    };
    expect(isDependencySatisfied(question, answers)).toBe(true);
  });

  test('should return false when first dependency is not satisfied (AND)', () => {
    const question = { dependency_rule: 'AND', dependency: deps };
    const answers = {
      1723459200018: [],
      1723459210020: ['pvc'],
    };
    expect(isDependencySatisfied(question, answers)).toBe(false);
  });

  test('should return false when second dependency is not satisfied (AND)', () => {
    const question = { dependency_rule: 'AND', dependency: deps };
    const answers = {
      1723459200018: ['raw_water_pipeline'],
      1723459210020: [],
    };
    expect(isDependencySatisfied(question, answers)).toBe(false);
  });

  test('should return false when no dependencies are satisfied (AND)', () => {
    const question = { dependency_rule: 'AND', dependency: deps };
    const answers = {
      1723459200018: [],
      1723459210020: [],
    };
    expect(isDependencySatisfied(question, answers)).toBe(false);
  });
});

describe('isDependencySatisfied - default behavior', () => {
  test('should default to AND when dependency_rule is not specified', () => {
    const deps = [
      { id: 1, options: ['a'] },
      { id: 2, options: ['b'] },
    ];
    const question = { dependency: deps }; // No dependency_rule specified
    const answers = {
      1: ['a'],
      2: ['b'],
    };
    expect(isDependencySatisfied(question, answers)).toBe(true);
  });

  test('should default to AND and return false when one dependency fails', () => {
    const deps = [
      { id: 1, options: ['a'] },
      { id: 2, options: ['b'] },
    ];
    const question = { dependency: deps }; // No dependency_rule specified
    const answers = {
      1: ['a'],
      2: [], // Second dependency not satisfied
    };
    expect(isDependencySatisfied(question, answers)).toBe(false);
  });

  test('should return true when no dependencies exist', () => {
    const question = { dependency: [] };
    const answers = {};
    expect(isDependencySatisfied(question, answers)).toBe(true);
  });

  test('should return true when dependency is undefined', () => {
    const question = {};
    const answers = {};
    expect(isDependencySatisfied(question, answers)).toBe(true);
  });
});

describe('isDependencySatisfied - case insensitive rule', () => {
  test('should handle lowercase "or" as OR', () => {
    const question = {
      dependency_rule: 'or',
      dependency: [
        { id: 1, options: ['a'] },
        { id: 2, options: ['b'] },
      ],
    };
    const answers = {
      1: ['a'],
      2: [],
    };
    expect(isDependencySatisfied(question, answers)).toBe(true);
  });

  test('should handle mixed case "Or" as OR', () => {
    const question = {
      dependency_rule: 'Or',
      dependency: [
        { id: 1, options: ['a'] },
        { id: 2, options: ['b'] },
      ],
    };
    const answers = {
      1: [],
      2: ['b'],
    };
    expect(isDependencySatisfied(question, answers)).toBe(true);
  });
});

describe('isDependencySatisfied - single dependency', () => {
  test('should work with single dependency using AND (implicit)', () => {
    const question = {
      dependency: [{ id: 1723459200018, options: ['air_valve'] }],
    };
    const answers = {
      1723459200018: ['air_valve'],
    };
    expect(isDependencySatisfied(question, answers)).toBe(true);
  });

  test('should work with single dependency using OR', () => {
    const question = {
      dependency_rule: 'OR',
      dependency: [{ id: 1723459200018, options: ['air_valve'] }],
    };
    const answers = {
      1723459200018: ['air_valve'],
    };
    expect(isDependencySatisfied(question, answers)).toBe(true);
  });

  test('should return false when single dependency is not met', () => {
    const question = {
      dependency: [{ id: 1723459200018, options: ['air_valve'] }],
    };
    const answers = {
      1723459200018: ['washout'],
    };
    expect(isDependencySatisfied(question, answers)).toBe(false);
  });
});

describe('isDependencySatisfied - OR rule with ancestor dependencies (recursive)', () => {
  test('should show raw_water_main question only when borehole selected AND raw_water_main selected', () => {
    // This simulates the bug scenario:
    // - Question 1749621851234 (type_of_project) - parent
    // - Question 1749622726349 (accessible_borehole_construction_site) depends on 1749621851234
    // - Question 1723459200017 (raw_water_main_gps_location) depends on 1749622726349 OR others

    // All questions (for ancestor lookups)
    const allQuestions = [
      {
        id: 1749621851234,
        name: 'type_of_project',
        type: 'option',
        // No dependencies
      },
      {
        id: 1749622726348,
        name: 'accessible_surface_water_construction_site',
        type: 'multiple_option',
        dependency: [{ id: 1749621851234, options: ['surface_water_project'] }],
      },
      {
        id: 1749622726349,
        name: 'accessible_borehole_construction_site',
        type: 'multiple_option',
        dependency: [{ id: 1749621851234, options: ['borehole'] }],
      },
      {
        id: 1749622726350,
        name: 'accessible_desalination_construction_site',
        type: 'multiple_option',
        dependency: [{ id: 1749621851234, options: ['desalination'] }],
      },
    ];

    const question = {
      id: 1723459200017,
      name: 'raw_water_main_gps_location',
      dependency_rule: 'OR',
      dependency: [
        { id: 1749622726348, options: ['raw_water_main'] },
        { id: 1749622726349, options: ['raw_water_main'] },
        { id: 1749622726350, options: ['raw_water_main'] },
      ],
    };

    // User selected "borehole" but NOT "raw_water_main" yet
    const answers = {
      1749621851234: 'borehole',
      1749622726349: [], // No construction site selected yet
    };

    // Should be FALSE because none of the OR dependencies are satisfied:
    // - 1749622726348 not satisfied (no raw_water_main)
    // - 1749622726349 not satisfied (no raw_water_main)
    // - 1749622726350 not satisfied (no raw_water_main)
    expect(isDependencySatisfied(question, answers, allQuestions)).toBe(false);
  });

  test('should show raw_water_main question when borehole selected AND raw_water_main selected', () => {
    const allQuestions = [
      {
        id: 1749621851234,
        name: 'type_of_project',
        type: 'option',
      },
      {
        id: 1749622726348,
        name: 'accessible_surface_water_construction_site',
        type: 'multiple_option',
        dependency: [{ id: 1749621851234, options: ['surface_water_project'] }],
      },
      {
        id: 1749622726349,
        name: 'accessible_borehole_construction_site',
        type: 'multiple_option',
        dependency: [{ id: 1749621851234, options: ['borehole'] }],
      },
      {
        id: 1749622726350,
        name: 'accessible_desalination_construction_site',
        type: 'multiple_option',
        dependency: [{ id: 1749621851234, options: ['desalination'] }],
      },
    ];

    const question = {
      id: 1723459200017,
      name: 'raw_water_main_gps_location',
      dependency_rule: 'OR',
      dependency: [
        { id: 1749622726348, options: ['raw_water_main'] },
        { id: 1749622726349, options: ['raw_water_main'] },
        { id: 1749622726350, options: ['raw_water_main'] },
      ],
    };

    // User selected "borehole" AND "raw_water_main"
    const answers = {
      1749621851234: 'borehole',
      1749622726349: ['raw_water_main', 'reservoir'],
    };

    // Should be TRUE because one dependency (with ancestors) is fully satisfied
    expect(isDependencySatisfied(question, answers, allQuestions)).toBe(true);
  });

  test('should NOT show when wrong project type selected even if raw_water_main selected', () => {
    const allQuestions = [
      {
        id: 1749621851234,
        name: 'type_of_project',
        type: 'option',
      },
      {
        id: 1749622726348,
        name: 'accessible_surface_water_construction_site',
        type: 'multiple_option',
        dependency: [{ id: 1749621851234, options: ['surface_water_project'] }],
      },
      {
        id: 1749622726349,
        name: 'accessible_borehole_construction_site',
        type: 'multiple_option',
        dependency: [{ id: 1749621851234, options: ['borehole'] }],
      },
    ];

    const question = {
      id: 1723459200017,
      name: 'raw_water_main_gps_location',
      dependency_rule: 'OR',
      dependency: [
        { id: 1749622726348, options: ['raw_water_main'] },
        { id: 1749622726349, options: ['raw_water_main'] },
      ],
    };

    // User selected "desalination" and raw_water_main on borehole question
    const answers = {
      1749621851234: 'desalination',
      1749622726349: ['raw_water_main'],
    };

    // Should be FALSE because ancestors don't match
    expect(isDependencySatisfied(question, answers, allQuestions)).toBe(false);
  });

  test('should show when surface water project selected AND raw_water_main selected', () => {
    const allQuestions = [
      {
        id: 1749621851234,
        name: 'type_of_project',
        type: 'option',
      },
      {
        id: 1749622726348,
        name: 'accessible_surface_water_construction_site',
        type: 'multiple_option',
        dependency: [{ id: 1749621851234, options: ['surface_water_project'] }],
      },
      {
        id: 1749622726349,
        name: 'accessible_borehole_construction_site',
        type: 'multiple_option',
        dependency: [{ id: 1749621851234, options: ['borehole'] }],
      },
    ];

    const question = {
      id: 1723459200017,
      name: 'raw_water_main_gps_location',
      dependency_rule: 'OR',
      dependency: [
        { id: 1749622726348, options: ['raw_water_main'] },
        { id: 1749622726349, options: ['raw_water_main'] },
      ],
    };

    // User selected "surface_water_project" AND "raw_water_main"
    const answers = {
      1749621851234: 'surface_water_project',
      1749622726348: ['raw_water_main', 'dam'],
    };

    // Should be TRUE because chain 1 is fully satisfied
    expect(isDependencySatisfied(question, answers, allQuestions)).toBe(true);
  });

  test('should work with multiple levels of ancestors (3+ levels deep)', () => {
    const allQuestions = [
      {
        id: 1,
        name: 'grandparent',
        type: 'option',
      },
      {
        id: 2,
        name: 'parent',
        type: 'option',
        dependency: [{ id: 1, options: ['option_a'] }],
      },
      {
        id: 3,
        name: 'direct_dep',
        type: 'option',
        dependency: [{ id: 2, options: ['option_b'] }],
      },
    ];

    const question = {
      id: 999,
      name: 'deeply_nested_question',
      dependency_rule: 'OR',
      dependency: [{ id: 3, options: ['option_c'] }],
    };

    // All ancestors satisfied
    const answersAllSatisfied = {
      1: 'option_a',
      2: ['option_b'],
      3: ['option_c'],
    };
    expect(isDependencySatisfied(question, answersAllSatisfied, allQuestions)).toBe(true);

    // Only top-level satisfied (should fail)
    const answersTopOnly = {
      1: 'option_a',
      2: [],
      3: [],
    };
    expect(isDependencySatisfied(question, answersTopOnly, allQuestions)).toBe(false);

    // Only direct dependency satisfied (should fail)
    const answersDirectOnly = {
      1: null,
      2: [],
      3: ['option_c'],
    };
    expect(isDependencySatisfied(question, answersDirectOnly, allQuestions)).toBe(false);
  });
});

describe('isDependencySatisfied - AND rule with ancestor dependencies (recursive)', () => {
  // These tests verify that AND rule dependencies also check ancestors recursively
  test('should check ancestors for AND dependencies - simple case', () => {
    const allQuestions = [
      {
        id: 1,
        name: 'parent',
        type: 'option',
      },
      {
        id: 2,
        name: 'child',
        type: 'option',
        dependency: [{ id: 1, options: ['option_a'] }],
      },
    ];

    const question = {
      id: 3,
      name: 'grandchild',
      dependency_rule: 'AND',
      dependency: [{ id: 2, options: ['option_b'] }],
    };

    // Parent satisfied, child satisfied
    const answersAllSatisfied = {
      1: 'option_a',
      2: ['option_b'],
    };
    expect(isDependencySatisfied(question, answersAllSatisfied, allQuestions)).toBe(true);

    // Parent NOT satisfied, child has value
    const answersParentNotSatisfied = {
      1: 'option_x',
      2: ['option_b'],
    };
    expect(isDependencySatisfied(question, answersParentNotSatisfied, allQuestions)).toBe(false);
  });

  test('should handle multiple AND dependencies with ancestors', () => {
    const allQuestions = [
      {
        id: 1,
        name: 'project_type',
        type: 'option',
      },
      {
        id: 2,
        name: 'surface_water_site',
        type: 'multiple_option',
        dependency: [{ id: 1, options: ['surface_water'] }],
      },
      {
        id: 3,
        name: 'pipeline_type',
        type: 'option',
        dependency: [{ id: 2, options: ['pipeline'] }],
      },
    ];

    const question = {
      id: 4,
      name: 'pipeline_size',
      dependency_rule: 'AND',
      dependency: [
        { id: 2, options: ['pipeline'] },
        { id: 3, options: ['pvc'] },
      ],
    };

    // All ancestors satisfied
    const answersAllSatisfied = {
      1: 'surface_water',
      2: ['pipeline'],
      3: ['pvc'],
    };
    expect(isDependencySatisfied(question, answersAllSatisfied, allQuestions)).toBe(true);

    // Direct dependencies satisfied but ancestor not satisfied
    const answersAncestorNotSatisfied = {
      1: 'borehole', // Wrong project type
      2: ['pipeline'],
      3: ['pvc'],
    };
    expect(isDependencySatisfied(question, answersAncestorNotSatisfied, allQuestions)).toBe(false);
  });
});

describe('isDependencySatisfied - Rural Water Project nested dependencies (issue reproduction)', () => {
  // This test reproduces the exact issue from the GitHub issue:
  // Nested dependency questions fail to appear when parent dependencies are satisfied

  const allQuestions = [
    {
      id: 1749621851234,
      name: 'type_of_project',
      type: 'option',
      // No dependencies
    },
    {
      id: 1749622726348,
      name: 'accessible_surface_water_construction_site',
      type: 'multiple_option',
      dependency: [{ id: 1749621851234, options: ['surface_water_project'] }],
    },
    {
      id: 1749622726349,
      name: 'accessible_borehole_construction_site',
      type: 'multiple_option',
      dependency: [{ id: 1749621851234, options: ['borehole'] }],
    },
    {
      id: 1749622726350,
      name: 'accessible_desalination_construction_site',
      type: 'multiple_option',
      dependency: [{ id: 1749621851234, options: ['desalination'] }],
    },
    {
      id: 1723459210023,
      name: 'reservoir_name',
      type: 'multiple_option',
      dependency_rule: 'OR',
      dependency: [
        { id: 1749622726348, options: ['reservoir'] },
        { id: 1749622726349, options: ['reservoir'] },
        { id: 1749622726350, options: ['reservoir'] },
      ],
    },
    {
      id: 1849622785213,
      name: 'reservoir_inlet_type_of_pipe',
      type: 'multiple_option',
      dependency: [{ id: 1723459210023, options: ['reservoir_inlet'] }],
    },
  ];

  test('Step 1: Type of Project selected → surface_water_project', () => {
    // Q1749622726348 should be visible when surface_water_project is selected
    const question = allQuestions.find((q) => q.id === 1749622726348);
    const answers = {
      1749621851234: 'surface_water_project',
    };
    expect(isDependencySatisfied(question, answers, allQuestions)).toBe(true);
  });

  test('Step 2: Site Visit → reservoir selected', () => {
    // Q1723459210023 should be visible when reservoir is selected in surface water site
    const question = allQuestions.find((q) => q.id === 1723459210023);
    const answers = {
      1749621851234: 'surface_water_project',
      1749622726348: ['reservoir'],
    };
    expect(isDependencySatisfied(question, answers, allQuestions)).toBe(true);
  });

  test('Step 3: Reservoir Inspection → reservoir_inlet selected', () => {
    // Q1849622785213 should be visible when reservoir_inlet is selected
    const question = allQuestions.find((q) => q.id === 1849622785213);
    const answers = {
      1749621851234: 'surface_water_project',
      1749622726348: ['reservoir'],
      1723459210023: ['reservoir_inlet'],
    };
    expect(isDependencySatisfied(question, answers, allQuestions)).toBe(true);
  });

  test('Step 4: Nested dependency correctly handles stale data (should return false)', () => {
    // In this scenario, borehole is selected, but the dependency chain isn't satisfied
    const question = allQuestions.find((q) => q.id === 1849622785213);
    const answers = {
      1749621851234: 'borehole',
      1749622726348: ['reservoir'], // Stale data from previous selection
      1749622726349: [], // Empty - no borehole site selected
      1723459210023: ['reservoir_inlet'], // This has a value but its dependency isn't satisfied
    };
    // Q1849622785213 depends on Q1723459210023 having reservoir_inlet ✓
    // Q1723459210023 (OR rule) depends on Q1749622726348, Q1749622726349, or Q1749622726350 having reservoir
    // Q1749622726348 depends on Q1749621851234 being surface_water_project ✗ (it's borehole)
    // Q1749622726349 depends on Q1749621851234 being borehole ✓, but doesn't have reservoir ✗
    // Result: Q1723459210023's ancestors aren't satisfied, so Q1849622785213 should be false
    expect(isDependencySatisfied(question, answers, allQuestions)).toBe(false);
  });

  test('Step 5: Nested dependency should NOT appear when direct dependency not selected', () => {
    // Q1849622785213 should NOT be visible if reservoir_inlet is not selected
    const question = allQuestions.find((q) => q.id === 1849622785213);
    const answers = {
      1749621851234: 'surface_water_project',
      1749622726348: ['reservoir'],
      1723459210023: ['reservoir_outlet'], // Wrong option (not reservoir_inlet)
    };
    expect(isDependencySatisfied(question, answers, allQuestions)).toBe(false);
  });

  test('Full chain: All dependencies satisfied through nested path', () => {
    // Full chain from Type → Site → Inspection → Inlet Type
    const question = allQuestions.find((q) => q.id === 1849622785213);
    const answers = {
      1749621851234: 'surface_water_project',
      1749622726348: ['reservoir', 'dam'], // Multiple options, including reservoir
      1723459210023: ['reservoir_inlet', 'reservoir_outlet'], // Multiple options
    };
    expect(isDependencySatisfied(question, answers, allQuestions)).toBe(true);
  });

  test('Alternative path: Borehole project type with reservoir', () => {
    // Test OR logic - using borehole path instead of surface water
    const question = allQuestions.find((q) => q.id === 1723459210023);
    const answers = {
      1749621851234: 'borehole',
      1749622726349: ['reservoir'], // Borehole site with reservoir
    };
    expect(isDependencySatisfied(question, answers, allQuestions)).toBe(true);
  });

  test('Deeply nested with borehole path', () => {
    // Q1849622785213 via borehole path (OR dependency at intermediate level)
    const question = allQuestions.find((q) => q.id === 1849622785213);
    const answers = {
      1749621851234: 'borehole',
      1749622726349: ['reservoir'],
      1723459210023: ['reservoir_inlet'],
    };
    expect(isDependencySatisfied(question, answers, allQuestions)).toBe(true);
  });
});

describe('normalizeDeps', () => {
  test('should merge duplicate dependency IDs', () => {
    const deps = [
      { id: 123, options: ['a', 'b'] },
      { id: 123, options: ['c'] },
      { id: 456, options: ['x'] },
    ];
    const result = normalizeDeps(deps);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 123, options: ['a', 'b', 'c'] });
    expect(result[1]).toEqual({ id: 456, options: ['x'] });
  });

  test('should remove duplicate options when merging', () => {
    const deps = [
      { id: 123, options: ['a', 'b'] },
      { id: 123, options: ['b', 'c'] },
    ];
    const result = normalizeDeps(deps);
    expect(result).toHaveLength(1);
    expect(result[0].options).toEqual(['a', 'b', 'c']);
  });

  test('should handle empty dependency array', () => {
    const result = normalizeDeps([]);
    expect(result).toEqual([]);
  });

  test('should handle undefined or null input', () => {
    expect(normalizeDeps()).toEqual([]);
    expect(normalizeDeps(null)).toEqual([]);
  });
});

describe('intersection', () => {
  test('should find common elements between arrays', () => {
    expect(intersection([1, 2, 3], [2, 3, 4])).toEqual([2, 3]);
    expect(intersection(['a', 'b'], ['b', 'c'])).toEqual(['b']);
    expect(intersection([1, 2], [3, 4])).toEqual([]);
  });

  test('should handle empty arrays', () => {
    expect(intersection([], [1, 2])).toEqual([]);
    expect(intersection([1, 2], [])).toEqual([]);
  });
});
