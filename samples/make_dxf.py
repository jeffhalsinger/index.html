"""Generate samples/messy_part.dxf (millimetre units) for manual testing."""
import ezdxf
doc = ezdxf.new()
doc.units = ezdxf.units.MM  # sets $INSUNITS = 4
msp = doc.modelspace()
# Closed square from 4 separate lines (a real-world "loose segments" contour)
for a, b in [((0,0),(50,0)), ((50,0),(50,50)), ((50,50),(0,50)), ((0,50),(0,0))]:
    msp.add_line(a, b)
# Open contour: two lines that don't close back
msp.add_line((80,0),(120,0)); msp.add_line((120,0),(120,50))
# Closed circle (curve) and an open 90-degree arc (curve)
msp.add_circle((160,25), 15)
msp.add_arc((220,25), 15, start_angle=0, end_angle=90)
doc.saveas("samples/messy_part.dxf")
print("wrote samples/messy_part.dxf")
