# NE555 LED Blinker Demo Validation — PCB Forge 0.1

Goal: prove that the current PCB editor can handle a simple real circuit workflow.

## Demo circuit

Astable NE555 LED blinker:

- U1: NE555 timer, DIP-8 footprint
- R1: 10 kΩ timing resistor
- R2: 100 kΩ timing resistor
- C1: 10 µF timing capacitor
- C2: 100 nF decoupling capacitor
- LED1: red LED
- R3: 330 Ω LED resistor
- J1: 2-pin power connector
- GND copper zone
- silkscreen labels
- mounting holes

## Nets used

- GND
- VCC
- DISCH
- THRESH_TRIG
- OUT
- LED_OUT

## What to test

1. Import `examples/ne555_led_blinker_demo_v0_1.pcbforge`.
2. Verify components appear on the PCB board.
3. Verify pin names appear on U1:
   - 1 GND
   - 2 TRIG
   - 3 OUT
   - 4 RESET
   - 5 CTRL
   - 6 THRESH
   - 7 DISCH
   - 8 VCC
4. Verify BOM lists U1, R1, R2, R3, C1, C2, LED1, J1.
5. Verify Netlist shows all nets.
6. Run DRC.
7. Export manufacturing package.
8. Check generated files:
   - top copper
   - bottom copper
   - silkscreen
   - board outline
   - drill file
   - BOM CSV
   - position CSV

## Expected result

The project should import without crashing, display all objects, generate a BOM/netlist, and export manufacturing files.

Some DRC warnings are acceptable at this stage if the current rule engine is stricter than the demo geometry.
