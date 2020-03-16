###################################################################################
#
#    Shorepointsystem Private Limited
#    Author: Roja (21-9-18)
#
#
###################################################################################
import logging
from odoo import api, fields, models, tools

_logger = logging.getLogger(__name__)

#Vehicle Model Config
class VehicleModel(models.Model):
    _name = 'vehicle.model'
    _description = 'Model of a vehicle'
    _order = 'name asc'

    name = fields.Char('Model name', required=True)
    brand_id = fields.Many2one('vehicle.make', 'Make', required=True, help='Make of the vehicle')
    image = fields.Binary(related='brand_id.image', string="Logo")
    image_medium = fields.Binary(related='brand_id.image_medium', string="Logo (medium)")
    image_small = fields.Binary(related='brand_id.image_small', string="Logo (small)")
    category_id = fields.Many2one('vehicle.category', 'Category',  help='Vehicle category')
    model_year = fields.Char('Model Year',help='Year of the model')
    bodytype_id = fields.Many2one('vehicle.bodytype', 'Body Type',  help='Vehicle Body Type')
    #engine_id = fields.One2many('vehicle.engine','vehicle_model_id',string="Engine",required="True")
    @api.multi
    @api.depends('name', 'brand_id')
    def name_get(self):
        res = []
        for record in self:
            name = record.name
            if record.brand_id.name:
                name = record.brand_id.name + '/' + name
            res.append((record.id, name))
        return res

    @api.onchange('brand_id')
    def _onchange_brand(self):
        if self.brand_id:
            self.image_medium = self.brand_id.image
        else:
            self.image_medium = False

#Vehicle Variant Config
class VehicleVariant(models.Model):
    _name = 'vehicle.variant'
    _description = 'Vehicle Variant'
    _order = 'name asc'

    name = fields.Char('Variant name', required=True)
    vehicle_model_id = fields.Many2one('vehicle.model', 'Model', required=True, help='Variant of the vehicle')
    image = fields.Binary(related='vehicle_model_id.image', string="Logo")
    image_medium = fields.Binary(related='vehicle_model_id.image_medium', string="Logo (medium)")
    image_small = fields.Binary(related='vehicle_model_id.image_small', string="Logo (small)")
    #engine_id = fields.Many2one('vehicle.engine',string="Engine")
    category = fields.Char('Category',  help='Vehicle category')
    kerb_weight = fields.Char('Kerb Weight(kg)')
    wheel_base = fields.Char('Wheel Base(mm)')
    clutch_type = fields.Char('Clutch Type')
    gross_weight = fields.Char('Gross Weight(kg)')
    axle_configuration = fields.Char('Axle Configuration')
    @api.onchange('vehicle_model_id')
    def _onchange_brand(self):
        if self.vehicle_model_id:
            self.image_medium = self.vehicle_model_id.image
            if self.vehicle_model_id.category_id:
               self.category=self.vehicle_model_id.category_id.name
            else:
               self.category=False 
        else:
            self.image_medium = False

    @api.model
    def create(self, vals):
        if self.vehicle_model_id:
            if self.vehicle_model_id.category_id:
               vals['category']=self.vehicle_model_id.category_id.name
            else:
               vals['category']=False 
        return super(VehicleVariant, self).create(vals)

    @api.multi
    def write(self, vals):
        if self.vehicle_model_id:
            if self.vehicle_model_id.category_id:
               vals['category']=self.vehicle_model_id.category_id.name
            else:
               vals['category']=False 
        return super(VehicleVariant, self).write(vals)

    length = fields.Char('Overall Length(mm)')
    width = fields.Char('Overall Width(mm)')
    height = fields.Char('Overall Height(mm)')
    seating_capacity = fields.Char('Seating Capacity')
    cargo_space = fields.Char('Cargo Space(Litres)')
    spare_front_tyre_size =fields.Char('Spare Front Tyre Size')
    spare_rear_tyre_size=fields.Char('Spare Rear Tyre Size')
    wheel_type = fields.Char('Wheel Type')
    tyre_type = fields.Char('Tyre Type')
    front_tyre_size =fields.Char('Front Tyre Size')
    rear_tyre_size=fields.Char('Rear Tyre Size')
    engine_type = fields.Char('Type')
    displacement = fields.Char('Displacement(cc)')
    power = fields.Char('Power(ps @ rpm)')
    torque = fields.Char('Torque(Nm @ rpm)')
    transmission = fields.Char('Transmission')
    cylinder_no = fields.Char('Number of Cylinders')
    gear_no = fields.Char('Number of Gears')
    fuel_tank_capacity = fields.Char('Fuel Tank Capacity(Litres)')
    fuel_type = fields.Selection([('petrol','Petrol'),('diesel','Diesel'),('cng','CNG'),('lpg','LPG')],'Fuel Type')
    mileage = fields.Char('Mileage(km/l)')
    front_brake_type =fields.Char('Front Brake Type')
    rear_brake_type=fields.Char('Rear Brake Type')
    front_suspension =fields.Char('Front Suspension')
    rear_suspension=fields.Char('Rear Suspension')
    steering_type=fields.Char('Steering Type')
    turning_radius=fields.Float('Turning Radius(m)')
    engine_image = fields.Binary("Engine Image")
    starting_method=fields.Char('Starting Method')
    air_filter=fields.Char('Air Filter')
    battery=fields.Char('Battery')
    head_lamp=fields.Char('Head Lamp')
    front_seat_height=fields.Char('Front Seat Height')
    back_seat_height=fields.Char('Back Seat Height')
    underseat_storage=fields.Char('Underseat Storage')
    ground_clearance=fields.Char('Ground Clearance')
    bore = fields.Char('Bore')
    stroke = fields.Char('Stroke')
#Vehicle Category Config
class VehicleCategory(models.Model):
    _name = 'vehicle.category'
    _description = 'Category of the vehicle'
    _order = 'name asc'

    name = fields.Char('Category', required=True)
    #group = fields.Selection([('two','Two Wheelers'),('three','Three Wheelers'),('heavy','Heavy Vehicles'),('car','Car')],'Group')
class VehicleCategorybodyType(models.Model):
    _name = 'vehicle.bodytype'
    _description = 'Body Type of a vehicle'
    _order = 'name asc'

    name = fields.Char('Body Type', required=True)
    #category_id = fields.Many2one('vehicle.category', 'Category', required=True, help='Body Type of the vehicle')

#Vehicle Make Config
class VehicleMake(models.Model):
    _name = 'vehicle.make'
    _description = 'Brand of the vehicle'
    _order = 'name asc'

    name = fields.Char('Make', required=True)
    image = fields.Binary("Logo", attachment=True,
        help="This field holds the image used as logo for the brand, limited to 1024x1024px.")
    image_medium = fields.Binary("Medium-sized image", attachment=True,
        help="Medium-sized logo of the brand. It is automatically "
             "resized as a 128x128px image, with aspect ratio preserved. "
             "Use this field in form views or some kanban views.")
    image_small = fields.Binary("Small-sized image", attachment=True,
        help="Small-sized logo of the brand. It is automatically "
             "resized as a 64x64px image, with aspect ratio preserved. "
             "Use this field anywhere a small image is required.")

    @api.model
    def create(self, vals):
        tools.image_resize_images(vals)
        return super(VehicleMake, self).create(vals)

    @api.multi
    def write(self, vals):
        tools.image_resize_images(vals)
        return super(VehicleMake, self).write(vals)
