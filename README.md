# source-engine-model-loader

three.js loader for parsing source engine models

# Use

```js
import { SourceModelLoader } from 'source-engine-model-loader';

new SourceModelLoader()
  .load( '.../model.mdl', group => {
	
    scene.add( group );

  } );
```

# Unimplemented Features
- Mouths
- Flex controllers / Morph targets
- Levels of detail
- Inverse kinematic chains
- Animation sequences
