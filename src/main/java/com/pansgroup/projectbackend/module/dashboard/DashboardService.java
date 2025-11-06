package com.pansgroup.projectbackend.module.dashboard;

import com.pansgroup.projectbackend.module.dashboard.dto.DashboardResponseDto;


public interface DashboardService {
    DashboardResponseDto getDashboardData(String userEmail);

}
