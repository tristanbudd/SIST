<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

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
