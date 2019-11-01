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
