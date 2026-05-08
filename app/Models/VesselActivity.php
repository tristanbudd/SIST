<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $mmsi
 * @property string $type
 * @property string $severity
 * @property string $description
 * @property array $details
 * @property Carbon $started_at
 * @property Carbon|null $ended_at
 * @property bool $is_active
 */
class VesselActivity extends Model
{
    protected $guarded = [];

    protected $casts = [
        'details' => 'array',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function vessel()
    {
        return $this->belongsTo(Vessel::class, 'mmsi', 'mmsi');
    }
}
