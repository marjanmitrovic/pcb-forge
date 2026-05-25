# PCB Forge

React/TypeScript PCB editor prototype.

This version adds Copper Zone DRC checks:
- zone outside board
- invalid zone net
- overlapping zones with different nets on the same layer
- zone touching/too close to traces of another net
- zone touching/too close to pads of another net
- zone touching/too close to vias of another net
