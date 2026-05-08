<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $mmsi
 * @property float $lat
 * @property float $lng
 * @property float|null $speed
 * @property float|null $course
 * @property int|null $heading
 * @property int|null $navigational_status
 * @property Carbon $recorded_at
 */
class VesselPosition extends Model
{
    protected $guarded = [];

    protected $casts = [
        'recorded_at' => 'datetime',
        'position_accuracy' => 'boolean',
        'raim' => 'boolean',
    ];

    protected $appends = [
        'nav_status_text',
    ];

    public function vessel()
    {
        return $this->belongsTo(Vessel::class, 'mmsi', 'mmsi');
    }

    protected function navStatusText(): Attribute
    {
        return Attribute::make(
            get: fn () => Vessel::navigationStatusDescription($this->navigational_status)
        );
    }
}
