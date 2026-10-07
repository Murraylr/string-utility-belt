const { recipe } = await import('./strip-tracking')
console.log('COND', JSON.stringify((recipe.steps[1] as any).steps[0].condition))
